import { redirect } from "react-router";
import { linkGoogleAccountToStore } from "../repository/user.repository";

export const loader = async ({ request }) => {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
        throw new Response(`Google Oauth error: ${error}`, { status: 400 });
    }

    if (!code || !state) {
        throw new Response('Missing Oauth parameters.', { status: 400 });
    }

    const cookieHeader = request.headers.get("Cookie") || "";
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        if (key) acc[key] = value;
        return acc;
    }, {});
    const csrfToken = cookies["oauth_state"];
    const targetShop = cookies["oauth_shop"];

    if (csrfToken !== state) {
        throw new Response("Oauth state validation failed.", { status: 403 });
    }

    if (!targetShop) {
        throw new Response("Shop contextual destination lost in OAuth pipeline.", { status: 400 });
    }

    try {
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                code,
                client_id: process.env.GOOGLE_CLIENT_ID,
                client_secret: process.env.GOOGLE_CLIENT_SECRET,
                redirect_uri: process.env.GOOGLE_REDIRECT_URI,
                grant_type: 'authorization_code'
            })
        });

        const tokens = await tokenResponse.json();

        if (!tokenResponse.ok) {
            console.error("Google Token Exchange Error:", tokens);
            throw new Response("Failed to exchange token with Google.", { status: 500 });
        }

        // Fetch Google User Profile (email, sub/id, name, picture)
        const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
        });

        const userInfo = await userInfoRes.json();
        if (!userInfoRes.ok || !userInfo.sub) {
            console.error("Failed to fetch Google userinfo:", userInfo);
            throw new Response("Failed to fetch Google user profile.", { status: 500 });
        }

        // Link Google Account to the Shopify Store
        await linkGoogleAccountToStore({
            shop: targetShop,
            googleUser: {
                googleUserId: userInfo.sub,
                email: userInfo.email,
                name: userInfo.name,
                pictureUrl: userInfo.picture,
            },
            tokens,
        });

        console.log(`Successfully linked Google user (${userInfo.email}) to store (${targetShop})`);
    } catch (err) {
        console.error("Callback Execution Failure:", err);
        throw new Response("Internal Server Error during authentication callback", { status: 500 });
    }

    const cleanHeaders = new Headers();
    cleanHeaders.append("Set-Cookie", "oauth_state=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=None");
    cleanHeaders.append("Set-Cookie", "oauth_shop=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=None");
    cleanHeaders.append("Content-Type", "text/html");

    const sanitizedShop = targetShop.replace(".myshopify.com", "");
    const shop = targetShop;
    console.log(shop)
    const appDashboardUrl = `https://admin.shopify.com/store/${sanitizedShop}/apps/${process.env.SHOPIFY_API_KEY}`;

    return redirect(appDashboardUrl, { headers: cleanHeaders });
}