"use client"
import { useSession } from 'next-auth/react'
import { signIn, signOut } from "next-auth/react"
import Image from 'next/image';
import SwitchTheme from './components/SwitchTheme';

const doNip07Login = async () => {
    //const pubKey = await (window as any).nostr.getPublicKey();
    let signThis = {
        kind: 20069,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: 'login to nostr21.com',
    }

    let useMe = await (window as any).nostr.signEvent(signThis)
    console.log(useMe)

    signIn("credentials", {
        kind: useMe.kind,
        created_at: useMe.created_at,
        content: useMe.content,
        pubkey: useMe.pubkey,
        sig: useMe.sig,
        id: useMe.id,
        // callbackUrl: "/signup?relayname=" + name
    })
}

export default function ShowSession() {
    const { data: session, status } = useSession();

    return (
        <div className="font-jetbrains navbar bg-base-100 border-b border-base-200 pb-12">
            <div className="flex-1">
                <a href="/" className="btn btn-ghost normal-case text-xl">nostr21: curator</a>
            </div>

            <div className="flex-none">
                {!session ? (
                    <button
                        onClick={doNip07Login}
                        className="btn btn-ghost ml-2"
                    >
                        <span className="mr-2">nip-07</span>
                        <Image src="nostr_logo_prpl_wht_rnd.svg" alt="nip07" width={30} height={30} />
                        <span className="ml-2">Sign In</span>
                    </button>
                ) : (
                    <div className="dropdown dropdown-end">
                        <label tabIndex={0} className="btn cursor-pointer mask mask-squircle">
                            <div className="w-10 rounded-full">
                                <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80" />
                            </div>

                        </label>
                        <ul tabIndex={0} className="menu menu-compact dropdown-content mt-3 p-2 shadow bg-base-100 rounded-box w-52">
                            <li className="border-b border-base-200"><SwitchTheme /></li>
                            <li><a href="/dashboard">Dashboard</a></li>
                            <li><a href="/invoices">Invoices</a></li>
                            <li><a href="/posts">Posts</a></li>
                            <li className="border-b border-base-200"><a href="/signup">Sign-up</a></li>
                            <li>
                                <a onClick={() => signOut({ callbackUrl: "/" })} className="cursor-pointer">
                                    Sign Out
                                </a>
                            </li>

                        </ul>

                    </div>
                )}
            </div>
        </div>
    );
}