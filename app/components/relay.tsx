"use client"
import { nip19 } from "nostr-tools"
import { RelayWithEverything } from "./relayWithEverything"
import { useState } from "react"

function copyToClipboard(e: any, bolt: string) {
    e.preventDefault()
    navigator.clipboard.writeText(bolt).then(() => {
        console.log('Copied to clipboard!');
    });
}

export default function Relay(
    props: React.PropsWithChildren<{
        relay: RelayWithEverything;
        showEdit: boolean;
        showSettings: boolean;
        showDetail: boolean;
        showExplorer: boolean;
        showCopy: boolean;
        modActions?: boolean;
    }>) {

    const [profileDetail, setProfileDetails] = useState(props.relay.details)
    const [profileBanner, setProfileBanner] = useState(props.relay.banner_image)
    const [edited, setEdited] = useState(false)
    const [editing, setEditing] = useState(false)

    const handleSubmitEdit = async (event: any) => {
        event.preventDefault();
        // call to API to save relay details 
        const profileDetailsObj = { details: profileDetail, banner_image: profileBanner, payment_amount: props.relay.payment_amount };
        const profileDetailsJson = JSON.stringify(profileDetailsObj);
        const response = await fetch(`/api/relay/${props.relay.id}/settings`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: profileDetailsJson
        });
        setEditing(false)
        setEdited(true)
    }

    let useRelayWSS = "wss://" + props.relay.name + "." + props.relay.domain
    // if relay is external, use full domain name here
    if(props.relay.is_external) {
        useRelayWSS = "wss://" + props.relay.domain
    }

    let useRelayHttps = "https://" + props.relay.name + "." + props.relay.domain
    if(props.relay.is_external) {
        useRelayHttps = "https://" + props.relay.domain
    }

    let useDetails = ""
    if(props.relay.details) {
        useDetails = props.relay.details.split('\n').slice(0, 2).join('\n');
    }

    const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "http://localhost:3000"
    return (
        <div id={props.relay.id + "rootview"} className="lg:w-1/2 sm:w-full">
            {props.showDetail &&
                <a href={useRelayHttps} className="">
                    <div className="card rounded-none h-72 mr-12 mb-12 text-white selectable hover:bg-gray-800 hover:text-white hover:bg-opacity-80" style={{
                        backgroundImage: `url(${edited ? (profileBanner || "/green-check.png") : (props.relay.banner_image || "/green-check.png")})`,
                        backgroundSize: "cover",
                        textShadow: "0px 0px 5px rgba(0, 0, 0, 0.5)"
                    }}>
                        <div className="flex-grow"/>
                        <div className="card-body bg-black bg-opacity-80 hover:bg-gray-800 hover:text-white hover:bg-opacity-80 max-h-40">
                            <h2 className="card-title" style={{ whiteSpace: "pre-line", overflow: "hidden" }}>{props.relay.name}</h2>
                            <p className="text-sm" style={{ whiteSpace: "pre-line", overflow: "hidden" }}>{useRelayWSS}</p>
                            <p className="text-sm" style={{ whiteSpace: "pre-line", overflow: "hidden" }}>{edited ? (profileDetail || "") : (useDetails)}</p>
                        </div>
                    </div>


                </a>
            }

            {props.showCopy &&
                <div onClick={(e) => copyToClipboard(e, (useRelayWSS))} className="card lg:w-full shadow-xl text-white selectable mb-4 hover:bg-gray-800 hover:text-white hover:bg-opacity-80" style={{
                    backgroundImage: `url(${edited ? (profileBanner || "/green-check.png") : (props.relay.banner_image || "/green-check.png")})`,
                    backgroundSize: "cover",
                    textShadow: "0px 0px 5px rgba(0, 0, 0, 0.5)"
                }}>
                    <div className="card-body items-center justify-end">
                        <div className="card h-48 w-96"></div>
                        <div className="card h-48 w-96">
                            <div className="card-body bg-black bg-opacity-80 hover:bg-gray-800 hover:text-white hover:bg-opacity-80">
                                <h2 className="card-title mr-4 ml-2 mt-2" style={{ whiteSpace: "pre-wrap", overflow: "auto" }}>{props.relay.name}</h2>
                                <p className="mb-2 mr-4 ml-2 mt-2" style={{ whiteSpace: "pre-wrap", overflow: "auto" }}>{useRelayWSS}</p>
                                <p className="mb-2 mr-4 ml-2 mt-2" style={{ whiteSpace: "pre-wrap", minHeight: "52px", maxHeight: "52px", overflow: "auto" }}>{edited ? (profileDetail || "") : (props.relay.details || "")}</p>
                            </div>
                        </div>
                    </div>
                </div>
            }

            {props.showSettings &&
                <a href={`/curator?relay_id=${props.relay.id}`} className="">
                    <div className="card w-96 shadow-xl text-white selectable mb-4 hover:bg-gray-800 hover:text-white hover:bg-opacity-80" style={{
                        backgroundImage: `url(${edited ? (profileBanner || "/green-check.png") : (props.relay.banner_image || "/green-check.png")})`,
                        backgroundSize: "cover",
                        textShadow: "0px 0px 5px rgba(0, 0, 0, 0.5)"
                    }}>
                        <div className="card-body items-center justify-end">
                            <div className="card h-48 w-96"></div>
                            <div className="card h-48 w-96">
                                <div className="card-body bg-black bg-opacity-80 hover:bg-gray-800 hover:text-white hover:bg-opacity-80">
                                    <h2 className="card-title mr-4 ml-2 mt-2" style={{ whiteSpace: "pre-wrap", overflow: "auto" }}>{props.relay.name}</h2>
                                    <p className="mb-2 mr-4 ml-2 mt-2" style={{ whiteSpace: "pre-wrap", overflow: "auto" }}>{useRelayWSS}</p>
                                    <p className="mb-2 mr-4 ml-2 mt-2" style={{ whiteSpace: "pre-wrap", minHeight: "52px", maxHeight: "52px", overflow: "auto" }}>{edited ? (profileDetail || "") : (props.relay.details || "")}</p>
                                </div>
                            </div>
                        </div>
                    </div>


                </a>
            }
            {props.showCopy &&
                <div>
                    <div className="justify-center mt-2">
                        <button className="btn btn-notice"
                            onClick={(e) => copyToClipboard(e, (useRelayWSS))}>
                            copy to clipboard
                        </button>
                    </div>
                </div>

            }

            {props.showEdit &&
                <div className="justify-center mt-2">
                    <button className="btn btn-primary"
                        onClick={() => setEditing(true)}>
                        edit details
                    </button>
                </div>
            }
            {
                editing &&
                <div className="form-control mt-4">
                    <label className="label">
                        <span className="label-text">Relay Profile</span>
                    </label>
                    <textarea id={props.relay.id + "textareaedit"} className="textarea textarea-bordered h-24"
                        placeholder="description"
                        value={profileDetail || ""}
                        onChange={(e) => setProfileDetails(e.target.value)}>
                    </textarea>
                    <label className="label">
                        <span className="label-text">Banner image url</span>
                    </label>
                    <input id={props.relay.id + "urlid"} type="text" placeholder="enter image url" className="input input-bordered w-full"
                        onChange={(e) => setProfileBanner(e.target.value)}
                        value={profileBanner || ""} />
                    <div className="flex justify-end gap-2">
                        <button className="btn btn-primary mt-2" onClick={(e) => handleSubmitEdit(e)}>Save</button>
                        <button className="btn btn-primary mt-2" onClick={() => setEditing(false)}>Cancel</button>
                    </div>
                </div>
            }
            {props.showExplorer &&
                <div>
                    <div className="justify-center mt-2">
                        <a href={"https://nostrrr.com/relay/" + nip19.nrelayEncode(useRelayWSS)} className="btn btn-secondary">
                            open in relay explorer<span className="sr-only">, {props.relay.id}</span>
                        </a>
                    </div>

                    {props.modActions != null && props.modActions == true && 
                    <div className="justify-center mt-2">
                        <a href={rootDomain + "/posts?mod=true&relay_id=" + props.relay.id + "&relay=" + nip19.nrelayEncode(useRelayWSS)} className="btn btn-secondary">
                            open in relay explorer (alpha)<span className="sr-only">, {props.relay.id}</span>
                        </a>
                    </div>
    }

                    {props.modActions == null || props.modActions == false && 
                    <div className="justify-center mt-2">
                        <a href={rootDomain + "/posts?relay_id=" + props.relay.id + "&relay=" + nip19.nrelayEncode(useRelayWSS)} className="btn btn-secondary">
                            open in relay explorer (alpha)<span className="sr-only">, {props.relay.id}</span>
                        </a>
                    </div>
    }
                </div>
            }



        </div>

    )
}