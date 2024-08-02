"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { nip19 } from "nostr-tools";
import {
    generateSecretKey,
    getPublicKey,
    finalizeEvent,
} from "nostr-tools/pure";
import NDK, {
    NDKEvent,
    NDKNip07Signer,
    NDKRelay,
    NDKRelayAuthPolicies,
    NDKAuthPolicy,
    NDKRelaySet,
    NDKSubscription,
} from "@nostr-dev-kit/ndk";
import { useSearchParams } from "next/navigation";
import { RelayWithEverything } from "../components/relayWithEverything";
import RelayMenuBar from "../relays/relayMenuBar";
import RelayDetail from "../components/relayDetail";
import RelayPayment from "../components/relayPayment";
import Terms from "../components/terms";
import Image from "next/image";

interface Event {
    pubkey: string;
    content: any;
    kind: any;
    created_at: any;
    id: any;
    sig: any;
    tags: any;
}

interface ProfileContent {
    picture: any;
    nip05: any;
    name: any;
}

interface Profile {
    pubkey: any;
    content: any;
}

//const nip07signer = new NDKNip07Signer();

const ndk = new NDK({
    //   signer: nip07signer,
    autoConnectUserRelays: false,
    enableOutboxModel: false,
});

const ndkPool = ndk.pool;

function copyToClipboard(e: any, bolt: string) {
    e.preventDefault();
    navigator.clipboard.writeText(bolt).then(() => {
        console.log("Copied to clipboard!");
    });
}

export default function PostsPage(
    props: React.PropsWithChildren<{
        relay: RelayWithEverything;
        publicRelays: RelayWithEverything[];
        stats: any;
    }>
) {
    const { data: session, status } = useSession();
    const [posts, setPosts] = useState<Event[]>([]);
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [relayStatus, setRelayStatus] = useState(["initializing"]);
    const [showPost, setShowPost] = useState<Event>();
    const [showImages, setShowImages] = useState(false);
    const [replyPost, setReplyPost] = useState("");
    const [myPubkey, setMyPubkey] = useState("");
    const [modActions, setModActions] = useState(false);
    const [showKind, setShowKind] = useState("1");
    const [showKindPicker, setShowKindPicker] = useState(false);

    const relayLimit = 100;

    async function grabNewKinds(newKind: string) {
        var kindOtherSub: NDKSubscription;
        const kindToInteger = parseInt(newKind);
        kindOtherSub = ndk.subscribe(
            { kinds: [kindToInteger], limit: relayLimit },
            { closeOnEose: false, groupable: false }
        );
        kindOtherSub.on("event", (event: NDKEvent) => {
            // do profile lookups on the fly
            /*
            if(lookupProfileName(event.pubkey) == event.pubkey) {
                const profileSubAuth = ndk.subscribe({ kinds: [0], authors: [event.pubkey] }, {closeOnEose: true, groupable: true});
                profileSubAuth.on("event", (pevent: NDKEvent) => {
                    addProfile(pevent);
                });
            } */
            console.log("got new event", event);
            addPost(event);
        });
    }

    let signerFailed = false

    async function grabStuff(nrelaydata: string, auth: boolean = false) {
        var kind1Sub: NDKSubscription;

        const nip07signer = new NDKNip07Signer();
        try {
            const activeUser = await nip07signer.blockUntilReady();
            ndk.signer = nip07signer;
        } catch (e) {
            console.log("signer extension timed out");
            if(useAuth == true) {
                signerFailed = true
            }
        }

        ndkPool.on("flapping", (flapping: NDKRelay) => {
            addToStatus("relay is flapping: " + flapping.url);
        });
        ndkPool.on("relay:auth", (relay: NDKRelay, challenge: string) => {
            addToStatus("auth: " + props.relay.name);
        });

        ndkPool.on("relay:authed", (relay: NDKRelay) => {
            addToStatus("authed: " + props.relay.name);
            wipePosts();
            console.log("authing?");
            const kindToInteger = parseInt(showKind);
            kind1Sub = ndk.subscribe(
                { kinds: [kindToInteger], limit: relayLimit },
                { closeOnEose: false, groupable: false }
            );
            kind1Sub.on("event", (event: NDKEvent) => {
                // do profile lookups on the fly
                if (lookupProfileName(event.pubkey) == event.pubkey) {
                    const profileSubAuth = ndk.subscribe(
                        { kinds: [0], authors: [event.pubkey] },
                        { closeOnEose: true, groupable: true }
                    );
                    profileSubAuth.on("event", (pevent: NDKEvent) => {
                        addProfile(pevent);
                    });
                }
                addPost(event);
            });
        });

        ndkPool.on("relay:disconnect", (relay: NDKRelay) => {
            if (kind1Sub != undefined) {
                kind1Sub.stop();
            }
            addToStatus("disconnected: " + props.relay.name);
        });

        ndkPool.on("relay:connect", (relay: NDKRelay) => {
            addToStatus("connected: " + props.relay.name);
            wipePosts();
            if (!auth) {
                const kindToInteger = parseInt(showKind);
                kind1Sub = ndk.subscribe(
                    { kinds: [kindToInteger], limit: relayLimit },
                    { closeOnEose: false, groupable: false }
                );
                kind1Sub.on("event", (event: NDKEvent) => {
                    // do profile lookups on the fly
                    if (lookupProfileName(event.pubkey) == event.pubkey) {
                        const profileSubAuth = ndk.subscribe(
                            { kinds: [0], authors: [event.pubkey] },
                            { closeOnEose: true, groupable: true }
                        );
                        profileSubAuth.on("event", (pevent: NDKEvent) => {
                            addProfile(pevent);
                        });
                    }
                    addPost(event);
                });
            } else if(signerFailed) {
                addToStatus("sign-in required: " + props.relay.name);
            }
        });

        ndkPool.on("relay:connecting", (relay: NDKRelay) => {
            //addToStatus("connecting: " + relay.url);
        });

        ndkPool.on("relay:authfail", (relay: NDKRelay) => {
            addToStatus("unauthorized: " + props.relay.name);
        });

        //const customAuthPolicy =

        ndk.addExplicitRelay(
            nrelaydata,
            NDKRelayAuthPolicies.signIn({ ndk }),
            true
        );
    }

    async function addToStatus(message: string) {
        setRelayStatus((arr) => [...arr, message]);
    }

    const addPost = (e: any) => {
        const newPost: Event = e;
        setPosts((prevPosts) => [newPost, ...prevPosts]);
    };

    const wipePosts = () => {
        setPosts([]);
    };

    const removePost = (e: any) => {
        var setNewPosts: Event[] = [];
        posts.forEach((post) => {
            if (post.id != e.id) {
                setNewPosts.push(post);
            }
        });
        setPosts(setNewPosts);
    };

    const removePostPubkey = (e: any) => {
        var setNewPosts: Event[] = [];
        posts.forEach((post) => {
            if (post.pubkey != e.pubkey) {
                setNewPosts.push(post);
            }
        });
        setPosts(setNewPosts);
    };

    const addProfile = (e: any) => {
        const newProfileContent: ProfileContent = JSON.parse(e.content);
        const newProfile: Profile = {
            pubkey: e.pubkey,
            content: newProfileContent,
        };
        setProfiles((prevProfiles) => [newProfile, ...prevProfiles]);
    };

    var nrelaydata: string;
    var useAuth: boolean;

    if (props.relay == null || props.relay.name == null) {
        nrelaydata = "wss://nostr21.com";
        useAuth = false;
    } else if (props.relay.is_external) {
        nrelaydata = "wss://" + props.relay.domain;
        useAuth = props.relay.auth_required;
    } else {
        nrelaydata = "wss://" + props.relay.name + "." + props.relay.domain;
        useAuth = props.relay.auth_required;
    }

    const activeUser = ndk.activeUser;
    const activePubkey = activeUser?.pubkey;
    if (activePubkey != null && activePubkey != myPubkey) {
        console.log("setting my pubkey", activePubkey);
        setMyPubkey(activePubkey);
        const isModOrOwner =
            props.relay.moderators.some(
                (mod) => mod.user.pubkey == activePubkey
            ) || props.relay.owner.pubkey == activePubkey;
        if (isModOrOwner && modActions == false) {
            setModActions(true);
        }
        console.log("setting mod status", isModOrOwner);
    }

    useEffect(() => {
        grabStuff(nrelaydata, useAuth);
    }, []);

    function summarizePubkey(pubkey: string): string {
        if(pubkey == null){
            return "";
        }
        if (pubkey.length <= 60) {
            return pubkey;
        }
        const firstFour = pubkey.substring(0, 4);
        const lastFour = pubkey.substring(pubkey.length - 4);
        return `${firstFour}...${lastFour}`;
    }

    const lookupProfileName = (pubkey: string) => {
        for (let i = 0; i < profiles.length; i++) {
            if (profiles[i].pubkey == pubkey) {
                return profiles[i].content.name;
            }
        }

        return pubkey;
    };

    const lookupProfileImg = (pubkey: string) => {
        for (let i = 0; i < profiles.length; i++) {
            if (profiles[i].pubkey == pubkey) {
                return (
                    <div className="w-10 rounded-full">
                        <img src={profiles[i].content.picture} />
                    </div>
                );
            }
        }
        const pubkeySubstring = pubkey.substring(0, 4);
        return (
            <div className="avatar placeholder">
                <div className="bg-neutral-focus text-neutral-content rounded-full w-10">
                    <span className="text-sm">{pubkeySubstring}</span>
                </div>
            </div>
        );
    };

    const lookupNip05 = (pubkey: string) => {
        for (let i = 0; i < profiles.length; i++) {
            if (profiles[i].pubkey == pubkey) {
                return profiles[i].content.nip05;
            }
        }
        return "";
    };

    const handleClick = (e: any, post: Event) => {
        e.preventDefault();

        if (e.target.id == "") {
            console.log("clicked!" + e.target.parentElement.id);
        } else {
            console.log("clicked!" + e.target.id);
        }

        setShowPost(post);
    };

    const chatStartOrEnd = (post: Event) => {
        // post is from me, use chat-end
        if (ndk.activeUser?.pubkey == post.pubkey) {
            return "chat chat-end hover:bg-primary-focus hover:text-white";
        } else {
            // post is from someone else, use chat-start
            return "chat chat-start hover:bg-primary-focus hover:text-white chat-secondary";
        }
    };

    const sortPosts = (ascending: boolean = true) => {
        const sortedPosts = [...posts].sort((a, b) => {
            const dateA = new Date(a.created_at).getTime();
            const dateB = new Date(b.created_at).getTime();
            return ascending ? dateA - dateB : dateB - dateA;
        });
        return sortedPosts;
    };

    const showContentWithoutLinks = (content: string) => {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        return content.replace(urlRegex, "");
    };

    const parseOutAndShowLinks = (content: string) => {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const urls: string[] = [];
        content.replace(urlRegex, (url: string) => {
            urls.push(url);
            return url;
        });

        const njumpRegex = /(nostr:n[^\s]+)/g;
        content.replace(njumpRegex, (njump: string) => {
            urls.push("https://njump.me/" + njump);
            return njump;
        });

        return urls;
    };

    const parseOutAndShowNjumps = (content: string) => {
        const njumpRegex = /(nostr:n[^\s]+)/g;
        const njumps: string[] = [];

        content.replace(njumpRegex, (njump: string) => {
            njumps.push("https://njump.me/" + njump);
            return "";
        });

        return njumps;
    };

    const showLocalTime = (unixTime: any) => {
        const date = new Date(unixTime * 1000); // Convert to milliseconds
        const localTime = date.toLocaleString(); // Format as local time string
        return localTime;
    };

    const parseOutAndShowImages = (content: string) => {
        const urlRegex = /(https?:\/\/[^\s]+?\.(jpg|png|gif|jpeg))/g;
        const urls: string[] = [];
        content.replace(urlRegex, (url: string) => {
            urls.push(url);
            return url;
        });
        return urls;
    };

    const findReply = (eventId: string) => {
        let foundpost: any;
        posts.forEach((post) => {
            if (post.id == eventId) {
                foundpost = post;
            }
        });
        if (foundpost != undefined) {
            return (
                <div>
                    {/*<div>{isReply(foundpost)}</div>*/}
                    <div
                        key={"replyfoundpost" + foundpost.id}
                        className={
                            chatStartOrEnd(foundpost) +
                            " overflow-hidden"
                        }
                        onClick={(e) => handleClick(e, foundpost)}
                    >
                        <div className="chat-image avatar">
                            {lookupProfileImg(foundpost.pubkey)}
                        </div>
                        <div className="chat-header">
                            <div className="flex items-center space-x-2">
                                <div className="hover:text-white overflow-x-auto">
                                    {summarizePubkey(
                                        lookupProfileName(foundpost.pubkey)
                                    )}
                                </div>
                                <time className="text-xs text-notice opacity-80">
                                    {lookupNip05(foundpost.pubkey)}
                                </time>
                            </div>
                        </div>

                        <div className="chat-bubble chat-bubble-gray-100 text-white selectable h-auto overflow-hidden">
                            {showContentWithoutLinks(foundpost.content)}
                        </div>
                        <div className="chat-footer opacity-50">
                            {showLocalTime(foundpost.created_at)}
                        </div>
                    </div>
                </div>
            );
        } else {
            return <></>;
        }
    };

    const isReply = (post: Event) => {
        let etags: string[] = [];
        post.tags.forEach((t: any) => {
            if (t[0] == "e") {
                etags.push(t);
            }
        });
        let ptags: string[] = [];
        post.tags.forEach((t: any) => {
            if (t[0] == "p") {
                ptags.push(t);
            }
        });

        return (
            <div>
                {etags.map((tag: any) => (
                    <div key={"tage" + tag}>{findReply(tag[1])}</div>
                ))}
            </div>
        );
    };

    const handleReply = async () => {
        if (showPost != undefined) {
            const replyEvent = new NDKEvent(ndk);
            replyEvent.kind = 1;
            replyEvent.tags = [
                ["p", showPost.pubkey],
                ["e", showPost.id],
            ];
            replyEvent.content = replyPost;
            await replyEvent.publish();
            //clear the form
            setShowPost(undefined);
        }
    };

    // todo, delete from view
    const handleDeleteEvent = async () => {
        if (showPost != undefined) {
            const dEvent = new NDKEvent(ndk);
            dEvent.kind = 7;
            dEvent.tags = [["e", showPost.id]];
            dEvent.content = "❌";
            await dEvent.publish();
            removePost(showPost);
            //clear the form
            setShowPost(undefined);
        }
    };

    const handleBlockPubkey = async () => {
        if (showPost != undefined) {
            // call to API to add new keyword
            const response = await fetch(
                `/api/relay/${props.relay.id}/blocklistpubkey`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        pubkey: showPost.pubkey,
                        reason: "mod action",
                    }),
                }
            );

            if (response.ok) {
                const j = await response.json();
            }
        }
    };

    const handleBlockAndDelete = async () => {
        // delete part
        if (showPost != undefined) {
            // deleting phase
            const dEvent = new NDKEvent(ndk);
            dEvent.kind = 7;
            dEvent.tags = [["p", showPost.pubkey]];
            dEvent.content = "🔨";
            await dEvent.publish();

            // blocking phase
            handleBlockPubkey();
            // remove from UI
            removePostPubkey(showPost);
            //clear the form
            setShowPost(undefined);
        }
    };

    const handleClosePost = async () => {
        setShowPost(undefined);
        setShowImages(false);
    };

    const handleSubmitPost = async (e: any) => {
        e.preventDefault();

        const form = e.target;
        const post = form.elements[0].value;

        // anonymous postin!
        // generates new key each time
        /*
            const newSK = generateSecretKey();
            const newPK = getPublicKey(newSK);
            const event = finalizeEvent({
                kind: 1,
                created_at: Math.floor(Date.now() / 1000),
                tags: [],
                content: post,
              }, newSK)

            const newEvent = new NDKEvent(ndk, event);
            await newEvent.publish();
            */

        const newEvent = new NDKEvent(ndk);
        newEvent.kind = 1;
        newEvent.content = post;
        await newEvent.publish();

        //clear the form
        form.elements[0].value = "";
    };

    const handleChangeKind = async (e: any) => {
        e.preventDefault();
        console.log("setting kind to " + e.target.value);
        setShowKindPicker(false);
        setShowKind(e.target.value);
        wipePosts();
        await grabNewKinds(e.target.value);
        console.log("grabbed");
    };

    const detectImages = (content: string) => {
        const urlRegex = /(https?:\/\/[^\s]+?\.(jpg|png|gif|jpeg))/g;
        const urls: string[] = [];
        content.replace(urlRegex, (url: string) => {
            urls.push(url);
            return url;
        });
        if (urls.length > 0) {
            return true;
        } else {
            return false;
        }
    };

    // this should be clickable and bring up some kind of menu/modal/drawer
    const displayRelayStatus = () => {
        var lastStatus: string;
        lastStatus = relayStatus[relayStatus.length - 1];
        var statusColor = "text-sm font-condensed ml-auto badge badge-neutral";
        if (
            lastStatus.includes("connected:") ||
            lastStatus.includes("authed:")
        ) {
            statusColor = "text-sm font-condensed ml-auto badge badge-success";
        }
        if (
            lastStatus.includes("disconnected:") ||
            lastStatus.includes("unauthorized:") ||
            lastStatus.includes("sign-in")
        ) {
            statusColor = "text-sm font-condensed ml-auto badge badge-warning";
        }
        return (
            <div className="drawer drawer-end justify-end">
                <input
                    id="my-drawer-4"
                    type="checkbox"
                    className="drawer-toggle"
                />
                <div className="drawer-content">
                    {/* Page content here */}
                    <label
                        htmlFor="my-drawer-4"
                        className="drawer-button flex items-center w-full"
                    >
                        <div className={statusColor}>
                            {relayStatus.findLast((item, i) => ({ item }))}
                        </div>
                        <div className="text-sm font-condensed ml-auto badge badge-neutral">
                            show options
                        </div>
                        <div className="bg-primary rounded-full">
                            <Image
                                alt="open drawer"
                                src="/gear-svgrepo-com.svg"
                                width={48}
                                height={48}
                            ></Image>
                        </div>
                    </label>
                </div>
                <div className="drawer-side z-10">
                    <label
                        htmlFor="my-drawer-4"
                        aria-label="close sidebar"
                        className="drawer-overlay"
                    ></label>
                    <div className="bg-base-200 text-base-content w-80 min-h-full">
                        <div className="mb-4">
                            <img
                                src={
                                    props.relay.banner_image ||
                                    "/green-check.png"
                                }
                            ></img>
                        </div>
                        <div className="text text-lg p-4 font-condensed">
                            {props.relay.details}
                        </div>
                        {props.relay.allow_list != null &&
                            !props.relay.default_message_policy && (
                                <div
                                    key="allowedpubkeycount"
                                    className="font-condensed p-4"
                                >
                                    Members:{" "}
                                    {props.relay.allow_list.list_pubkeys.length}
                                </div>
                            )}
                        <div className="mb-4">
                            <button
                                className="btn uppercase btn-notice"
                                onClick={(e) => copyToClipboard(e, nrelaydata)}
                            >
                                copy url to clipboard
                            </button>
                        </div>
                        {props.relay.payment_required && (
                            <RelayPayment
                                relay={props.relay}
                                pubkey={myPubkey}
                            />
                        )}
                        {/*<RelayDetail relay={props.relay} />*/}
                        {<Terms />}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="flex w-full">
            <div className="flex flex-wrap w-full fixed top-0 left-0 z-50 bg-base-100">
                <div className="flex w-full items-center mb-4">
                    <div className="drawer w-32">
                        <input
                            id="my-drawer"
                            type="checkbox"
                            className="drawer-toggle"
                        />
                        <div className="drawer-content">
                            <label
                                htmlFor="my-drawer"
                                className="drawer-button flex items-center"
                            >
                                <div className="bg-primary rounded-full">
                                    <Image
                                        alt="open drawer2"
                                        src="/arrow-left-square-svgrepo-com.svg"
                                        width={48}
                                        height={48}
                                    ></Image>
                                </div>
                                <div className="chat-image avatar">
                                    <div className="w-12 rounded-full">
                                        <img
                                            src={
                                                props.relay.banner_image ||
                                                "/green-check.png"
                                            }
                                        />
                                    </div>
                                </div>
                            </label>
                        </div>
                        <div className="drawer-side z-10">
                            <label
                                htmlFor="my-drawer"
                                aria-label="close sidebar"
                                className="drawer-overlay"
                            ></label>
                            <div className="menu bg-base-200 text-base-content min-h-full w-80">
                                {/* Sidebar content here */}
                                <RelayMenuBar relays={props.publicRelays} />
                            </div>
                        </div>
                    </div>
                    {displayRelayStatus()}
                </div>

                <div className="flex w-full items-center justify-center">
                    <form onSubmit={(e) => handleSubmitPost(e)} className="">
                        <input
                            type="text"
                            key="post1"
                            placeholder="say something"
                            className="input input-bordered input-primary"
                        />
                        <button className="btn uppercase btn-primary">
                            Post
                        </button>
                        {!showKindPicker && (
                            <button
                                onClick={(e) => setShowKindPicker(true)}
                                value={showKind}
                                key={showKind}
                                className="btn btn-secondary ml-4"
                            >
                                kind: {showKind}
                            </button>
                        )}
                    </form>
                </div>
                {showKindPicker && (
                    <div>
                        <div className="font-condensed items-center justify-center">
                            Event Kinds (seen) in the last 24 hours
                        </div>
                        <div className="flex flex-wrap rounded-sm border-primary border-2 w-full items-center justify-center">
                            {props.stats != undefined &&
                                props.stats.map((item: any) => (
                                    <button
                                        onClick={(e) => handleChangeKind(e)}
                                        value={item.kind}
                                        key={item.kind}
                                        className="btn btn-secondary"
                                    >
                                        kind: {item.kind} ({item._value})
                                    </button>
                                ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="flex flex-wrap w-full bg-base-100 pt-32 sm:pt-32">
                {showPost != undefined && (
                    <div className="bg-base-100">
                        <dialog
                            key={"my_modal_5" + showPost.id}
                            className="modal modal-top modal-open sm:modal-middle h-auto"
                        >
                            <form method="dialog" className="modal-box w-full">
                                <div className="flex justify-end">
                                    <div
                                        className="btn uppercase"
                                        onClick={() => handleClosePost()}
                                    >
                                        X
                                    </div>
                                </div>
                                <div>{isReply(showPost)}</div>
                                <div
                                    key={"post" + showPost.id}
                                    className={
                                        chatStartOrEnd(showPost) +
                                        "overflow-hidden"
                                    }
                                >
                                    <div className="chat-image avatar">
                                        {lookupProfileImg(showPost.pubkey)}
                                    </div>
                                    <div className="chat-header overflow-hidden">
                                        <div className="flex items-center space-x-2">
                                            <div className="hover:text-white overflow-hidden">
                                                {summarizePubkey(
                                                    lookupProfileName(
                                                        showPost.pubkey
                                                    )
                                                )}
                                            </div>
                                            <time className="text-xs text-notice opacity-80">
                                                {lookupNip05(showPost.pubkey)}
                                            </time>
                                        </div>
                                    </div>

                                    <div className="chat-bubble text-white selectable h-auto overflow-wrap break-words ">
                                        {showContentWithoutLinks(
                                            showPost.content
                                        )}
                                    </div>
                                    <div className="chat-footer opacity-50">
                                        {showLocalTime(showPost.created_at)}
                                    </div>
                                </div>

                                {parseOutAndShowLinks(showPost.content).map(
                                    (url) => (
                                        <div key={"2" + url} className="mb-4 overflow-hidden">
                                            <a
                                                href={url}
                                                className="link link-primary"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                {url}
                                            </a>
                                        </div>
                                    )
                                )}

                                {detectImages(showPost.content) && (
                                    <div>
                                        {showImages &&
                                            parseOutAndShowImages(
                                                showPost.content
                                            ).map((url) => (
                                                <div key={"1" + url}>
                                                    <img
                                                        src={url}
                                                        className="h-auto overflow-hidden"
                                                    ></img>
                                                </div>
                                            ))}
                                        <span className="flex justify-between mt-4">
                                            <div
                                                className="btn uppercase mb-4"
                                                onClick={() =>
                                                    setShowImages(!showImages)
                                                }
                                            >
                                                show images
                                            </div>
                                        </span>
                                    </div>
                                )}

                                <div className="flex items-center justify-center mb-4 mt-2">
                                    <input
                                        onChange={(e) =>
                                            setReplyPost(e.target.value)
                                        }
                                        type="text"
                                        key="replypost"
                                        placeholder="send reply"
                                        className="input input-bordered input-primary w-full"
                                    />
                                    <button
                                        className="btn uppercase btn-primary"
                                        onClick={() => handleReply()}
                                    >
                                        reply
                                    </button>
                                </div>

                                {modActions && (
                                    <div>
                                        <div className="w-full bg-gradient-to-r from-gray-600 to-gray-900 items-center h-5 px-3 sm:text-sm text-center mb-4">
                                            - actions -{" "}
                                        </div>
                                        <div className="mb-4">
                                            <button
                                                className="btn uppercase"
                                                onClick={() =>
                                                    handleDeleteEvent()
                                                }
                                            >
                                                delete event
                                            </button>
                                        </div>
                                        <div className="mb-4">
                                            <button
                                                className="btn uppercase"
                                                onClick={() =>
                                                    handleBlockPubkey()
                                                }
                                            >
                                                block pubkey
                                            </button>
                                        </div>
                                        <div className="mb-4">
                                            <button
                                                className="btn uppercase"
                                                onClick={() =>
                                                    handleBlockAndDelete()
                                                }
                                            >
                                                block & delete pubkey
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <div className="flex justify-center">
                                    <div
                                        className="flex justify-end btn btn-primary uppercase"
                                        onClick={() => handleClosePost()}
                                    >
                                        next
                                    </div>
                                </div>
                            </form>
                        </dialog>
                    </div>
                )}
                <div className="w-full flex flex-col">
                    {sortPosts(false).map((post) => (
                        <div
                            key={"post" + post.id}
                            className={
                                chatStartOrEnd(post) +
                                "w-full flex-grow overflow-wrap"
                            }
                            onClick={(e) => handleClick(e, post)}
                            id={"eventid:" + post.id + ";pubkey:" + post.pubkey}
                        >
                            <div className="chat-image avatar">
                                {lookupProfileImg(post.pubkey)}
                            </div>
                            <div className="chat-header overflow-hidden">
                                <div className="flex items-center space-x-2">
                                    <div className="hover:text-white overflow-hidden">
                                        {summarizePubkey(
                                            lookupProfileName(post.pubkey)
                                        )}
                                    </div>
                                    <time className="text-xs text-notice opacity-80">
                                        {lookupNip05(post.pubkey)}
                                    </time>
                                </div>
                            </div>


                            {post.kind == 1 && (
                                <div className="chat-bubble chat-bubble-gray-100 text-white selectable h-auto overflow-wrap break-words">
                                    {post.content}
                                </div>
                            )}
                            {post.kind != 1 && (
                                <div className="chat-bubble chat-bubble-gray-100 text-white selectable h-auto overflow-hidden">
                                    <div className="label label-text-sm">
                                        content
                                    </div>
                                    <div className="border-2 border-gray-300 rounded-lg p-4">
                                        {post.content && post.content}
                                        {!post.content && "no content"}
                                    </div>

                                    <div className="label label-text-sm">
                                        tags
                                    </div>
                                    <div className="border-2 border-gray-300 rounded-lg p-4 flex-col-2">
                                        {post.tags.map(
                                            (tag: any, index: number) => (
                                                <div className="flex">
                                                    {tag.map(
                                                        (
                                                            tval: any,
                                                            i: number
                                                        ) => (
                                                            <div
                                                                className="border-2 border-primary p-2"
                                                                key={tval + i}
                                                            >
                                                                {tval}
                                                            </div>
                                                        )
                                                    )}
                                                </div>
                                            )
                                        )}
                                    </div>
                                </div>
                            )}
                            <div className="chat-footer opacity-50">
                                {showLocalTime(post.created_at)}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
