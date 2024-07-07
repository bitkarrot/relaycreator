import NextAuth, { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import {
    verifyEvent,
    Event,
} from "nostr-tools"
import prisma from '../../../lib/prisma'

function isWithinLast10Minutes(timestampString: string) {
    // Convert the timestamp string to a number
    const timestamp = parseInt(timestampString, 10);

    // Get the current time in Unix timestamp format
    const now = Math.floor(Date.now() / 1000);

    // Calculate the time difference in seconds
    const diff = now - timestamp;

    const isDiff = (diff < 600) && (diff > -600)

    // Return true if the time difference is less than 10 minutes (600 seconds)
    return isDiff
}

async function updateOrCreateUser(user_pubkey: string) {
    const user = await prisma.user.findFirst({
        where: { pubkey: user_pubkey }
    })

    if (user == null) {
        const user = await prisma.user.create({
            data: {
                pubkey: user_pubkey,
                // todo: add last_login timestamp?
            },
        })
    }
}

const isTokenCreatedInTheLastHour = (token: any): boolean => {
    const ONE_HOUR_IN_MS = 60 * 60 * 1000;
    const tokenCreatedAt = new Date(token.created_at).getTime();
    const currentTime = Date.now();
    return currentTime - tokenCreatedAt <= ONE_HOUR_IN_MS;
};

export const authOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            name: "Nostr",
            credentials: {
                created_at: { label: "created_at", type: "text" },
                content: { label: "content", type: "text" },
                pubkey: { label: "pubkey", type: "text" },
                sig: { label: "sig", type: "text" },
                id: { label: "id", type: "text" },
            },

            async authorize(credentials) {
                //try {

                /*
                if process.env.NEXTAUTH_URL {
                    useMe = process.env.NEXTAUTH_URL
                }
                */

                if (!credentials?.sig) {
                    return null
                }

                // we can do a time check here serverside, to verify the event was created in this 5 min window or so.
                // todo: verify created_at is actually part of the signature on a nostr event. yes it is.
                /*if (!isWithinLast10Minutes(credentials.created_at)) {
                    return null
                }*/

                // find the token
                const isToken = await prisma.loginToken.findFirst({
                    where: {
                        token: credentials.content,
                    }
                })

                // token doesn't exist
                if (isToken == null) {
                    console.log("token doesnt exist")
                    return null
                }

                // token expired
                if (!isTokenCreatedInTheLastHour(isToken)) {
                    console.log("token expired")
                    return null
                }

                var verifyThis: Event = {
                    kind: 27235,
                    created_at: parseInt(credentials.created_at),
                    tags: [],
                    content: credentials.content,
                    pubkey: credentials.pubkey,
                    id: credentials.id,
                    sig: credentials.sig,
                }

                let veryOk = verifyEvent(verifyThis)
                //console.log(veryOk)

                if (!veryOk) {
                    return null
                }

                // cleanup the token
                await prisma.loginToken.delete({ where: { id: isToken.id } })

                // if user is verified, paratroop into prisma and create a user (or check one is created)
                updateOrCreateUser(credentials.pubkey)

                return {
                    id: credentials.pubkey,
                    name: credentials.pubkey,
                    email: credentials.pubkey
                }
            },
        }),
    ],

    session: {
        strategy: "jwt",
    },
    secret: process.env.NEXTAUTH_SECRET,
    callbacks: {
        async session({ session, token }: { session: any; token: any }) {
            //session.address = token.sub
            session.user.name = token.name
            session.user.id = token.id
            session.user.image = ""
            return session
        },
    },
}


// For more information on each option (and a full list of options) go to
// https://next-auth.js.org/configuration/options
/*
export default async function auth(req: any, res: any) {

    return await NextAuth(req, res, {
        authOptions,
    })
}
*/

export default NextAuth(authOptions)