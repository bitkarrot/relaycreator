"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { nip19 } from "nostr-tools";
import {generateSecretKey, getPublicKey, finalizeEvent} from 'nostr-tools/pure';
import NDK, { NDKEvent, NDKNip07Signer, NDKRelay, NDKRelayAuthPolicies, NDKAuthPolicy, NDKRelaySet, NDKSubscription } from "@nostr-dev-kit/ndk";
import { useSearchParams } from "next/navigation";

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

const nip07signer = new NDKNip07Signer();

const ndk = new NDK({
    signer: nip07signer,
    autoConnectUserRelays: false,
    enableOutboxModel: false,
});

const ndkPool = ndk.pool;

export default function PostsPage(
    /*
    props: React.PropsWithChildren<{
        relayURL: string;
    }>
    */
) {

    const { data: session, status } = useSession();
    const [posts, setPosts] = useState<Event[]>([]);
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [relayStatus, setRelayStatus] = useState(["initializing"]);
    const [showPost, setShowPost] = useState<Event>();
    const [showImages, setShowImages] = useState(false);
    const [replyPost, setReplyPost] = useState("");

    async function grabStuff(nrelaydata: string, auth: boolean = false) {
        var kind1Sub: NDKSubscription
        
        ndkPool.on("flapping", (flapping: NDKRelay) => {
            addToStatus("relay is flapping: " + flapping.url);
        });
        ndkPool.on("relay:auth", (relay: NDKRelay, challenge: string) => {
            addToStatus("auth: " + relay.url);
        });

        ndkPool.on("relay:authed", (relay: NDKRelay) => {
            addToStatus("authed: " + relay.url);
            wipePosts();
            kind1Sub = ndk.subscribe({ kinds: [1], limit: relayLimit }, {closeOnEose: false, groupable: false});
            kind1Sub.on("event", (event: NDKEvent) => {
                // do profile lookups on the fly
                if(lookupProfileName(event.pubkey) == event.pubkey) {
                    const profileSubAuth = ndk.subscribe({ kinds: [0], authors: [event.pubkey] }, {closeOnEose: true, groupable: true});
                    profileSubAuth.on("event", (pevent: NDKEvent) => {
                        addProfile(pevent);
                    });
                }
                addPost(event);
            });
        });
            
        ndkPool.on("relay:disconnect", (relay: NDKRelay) => {
            kind1Sub.stop()
            addToStatus("disconnected: " + relay.url);
        });

        ndkPool.on("relay:connect", (relay: NDKRelay) => {
            addToStatus("connected: " + relay.url);
            wipePosts();
            if(!auth) {
                kind1Sub = ndk.subscribe({ kinds: [1], limit: relayLimit }, {closeOnEose: false, groupable: false});
                kind1Sub.on("event", (event: NDKEvent) => {
                    // do profile lookups on the fly
                    if(lookupProfileName(event.pubkey) == event.pubkey) {
                        const profileSubAuth = ndk.subscribe({ kinds: [0], authors: [event.pubkey] }, {closeOnEose: true, groupable: true});
                        profileSubAuth.on("event", (pevent: NDKEvent) => {
                            addProfile(pevent);
                        });
                    }
                    addPost(event);
                });
            }
        });

        ndkPool.on("relay:connecting", (relay: NDKRelay) => {
            //addToStatus("connecting: " + relay.url);
        });

        ndk.addExplicitRelay(nrelaydata, NDKRelayAuthPolicies.signIn({ndk}), true);
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
    }

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

    const searchParams = useSearchParams();
    var relayparam: any;
    var relayLimit: any;
    var relay_id: any;
    var modActions: any;
    var useAuth: any;
    if (searchParams == null) {
        //if(props.relayURL == "") {
            relayparam = nip19.nrelayEncode("wss://nostr21.com");
            relayLimit = 100;
            useAuth = "false";
        //} else {
        //    relayparam = nip19.nrelayEncode("wss://" + props.relayURL);
        //    relayLimit = 50;
        //}
    } else {
        //if(props.relayURL) {
        //    relayparam= nip19.nrelayEncode("wss://" + props.relayURL);
        //} else {
        relayparam = searchParams.get("relay");
        if (relayparam == null) {
            relayparam = nip19.nrelayEncode("wss://nostr21.com");
        }
        const c = searchParams.get("limit");
        if (c == null) {
            relayLimit = 100;
        } else {
            relayLimit = parseInt(c);
        }
        relay_id = searchParams.get("relay_id");
        modActions = searchParams.get("mod");
        useAuth = searchParams.get("auth");
        //}
    }

    let { type, data } = nip19.decode(relayparam);
    let nrelaydata: any;
    if (type === "nrelay") {
        nrelaydata = data;
    }

    useEffect(() => {
        grabStuff(nrelaydata, useAuth == "true");
    }, []);

    function summarizePubkey(pubkey: string): string {
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
        if (session && session.user && session.user.name == post.pubkey) {
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

        const njumpRegex = /nostr?:(n[^\s]+)/g;
        const njumps: string[] = [];
        content.replace(njumpRegex, (njump: string) => {
            urls.push("https://njump.me/" + njump);
            return njump;
        });

        return urls;
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
                <div
                    key={"replyfoundpost" + foundpost.id}
                    className={
                        chatStartOrEnd(foundpost) +
                        " max-w-screen overflow-hidden"
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

                    <div
                        className="chat-bubble chat-bubble-gray-100 text-white selectable h-auto overflow-hidden max-w-screen"
                    >
                        {showContentWithoutLinks(foundpost.content)}
                    </div>
                    <div className="chat-footer opacity-50">
                        {showLocalTime(foundpost.created_at)}
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
        if (session && session.user && session.user.name && showPost != undefined) {
            const replyEvent = new NDKEvent(ndk);
            replyEvent.kind = 1;
            replyEvent.pubkey = session.user.name;
            replyEvent.tags = [
                ["p", showPost.pubkey],
                ["e", showPost.id],
            ];
            replyEvent.content = replyPost;
            await replyEvent.publish();
            //clear the form
            setShowPost(undefined);
        } else {
            console.log("not logged in");
        }
    };

    // todo, delete from view
    const handleDeleteEvent = async () => {
        if (session && session.user && session.user.name && showPost != undefined) {
            const dEvent = new NDKEvent(ndk);
            dEvent.kind = 7;
            dEvent.pubkey = session.user.name;
            dEvent.tags = [["e", showPost.id]];
            dEvent.content = "❌";
            await dEvent.publish();
            removePost(showPost);
            //clear the form
            setShowPost(undefined);
        } else {
            console.log("not logged in");
        }
    };

    const handleBlockPubkey = async () => {
        if (
            session &&
            session.user &&
            showPost != undefined &&
            relay_id != undefined
        ) {
            // call to API to add new keyword
            const response = await fetch(
                `/api/relay/${relay_id}/blocklistpubkey`,
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
        if (session && session.user && session.user.name && showPost != undefined) {
            // deleting phase
            const dEvent = new NDKEvent(ndk);
            dEvent.kind = 7;
            dEvent.pubkey = session.user.name;
            dEvent.tags = [["p", showPost.pubkey]];
            dEvent.content = "🔨";
            await dEvent.publish();
            
            // blocking phase
            handleBlockPubkey();
            // remove from UI
            removePostPubkey(showPost);
            //clear the form
            setShowPost(undefined);
        } else {
            console.log("not logged in");
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

        if (session && session.user && session.user.name) {

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
            newEvent.pubkey = session.user.name;
            newEvent.content = post;
            await newEvent.publish();

            //clear the form
            form.elements[0].value = "";
        } else {
            form.elements[0].value = "";
            form.elements[0].placeholder = "not logged in";
        }
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

    return (
        <div>
            <ul role="list" className="text-xs">
                {relayStatus.map((item, i) => (
                    <li key={"post" + i} className="px-1 py-1 sm:px-0">
                        {item}
                    </li>
                ))}
            </ul>
            <div className="flex items-center justify-center mb-2">
                <form
                    onSubmit={(e) => handleSubmitPost(e)}
                    className="flex items-center"
                >
                    <input
                        type="text"
                        key="post1"
                        placeholder="say something"
                        className="input input-bordered input-primary w-full"
                    />
                    <button className="btn uppercase btn-primary">Post</button>
                </form>
            </div>
            {showPost != undefined && (
                <div className="bg-base-100 flex">
                    <dialog
                        key={"my_modal_5" + showPost.id}
                        className="modal modal-top modal-open sm:modal-middle max-w-screen h-auto"
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
                                    "max-w-screen overflow-hidden"
                                }
                            >
                                <div className="chat-image avatar">
                                    {lookupProfileImg(showPost.pubkey)}
                                </div>
                                <div className="chat-header">
                                    <div className="flex items-center space-x-2">
                                        <div className="hover:text-white overflow-x-auto">
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

                                <div
                                    className="chat-bubble text-white selectable h-auto overflow-hidden max-w-screen "
                                >
                                    {showContentWithoutLinks(showPost.content)}
                                </div>
                                <div className="chat-footer opacity-50">
                                    {showLocalTime(showPost.created_at)}
                                </div>
                            </div>

                            {parseOutAndShowLinks(showPost.content).map(
                                (url) => (
                                    <div key={"2" + url}>
                                        <a
                                            href={url}
                                            className="link link-primary"
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
                                                    className="max-w-screen h-auto overflow-hidden"
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
                                            onClick={() => handleDeleteEvent()}
                                        >
                                            delete event
                                        </button>
                                    </div>
                                    <div className="mb-4">
                                        <button
                                            className="btn uppercase"
                                            onClick={() => handleBlockPubkey()}
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
            {sortPosts(false).map((post) => (
                <div
                    key={"post" + post.id}
                    className={
                        chatStartOrEnd(post) + " max-w-screen overflow-hidden"
                    }
                    onClick={(e) => handleClick(e, post)}
                    id={"eventid:" + post.id + ";pubkey:" + post.pubkey}
                >
                    <div className="chat-image avatar">
                        {lookupProfileImg(post.pubkey)}
                    </div>
                    <div className="chat-header max-w-screen overflow-hidden">
                        <div className="flex items-center space-x-2">
                            <div className="hover:text-white max-w-screen overflow-hidden">
                                {summarizePubkey(lookupProfileName(post.pubkey))}
                            </div>
                            <time className="text-xs text-notice opacity-80">
                                {lookupNip05(post.pubkey)}
                            </time>
                        </div>
                    </div>

                    <div
                        className="chat-bubble chat-bubble-gray-100 text-white selectable max-w-screen h-auto overflow-hidden"
                    >
                        {post.content}
                    </div>
                    <div className="chat-footer opacity-50">
                        {showLocalTime(post.created_at)}
                    </div>
                </div>
            ))}
        </div>
    );
}
