import dotenv from 'dotenv';
dotenv.config();

import express from "express";
import session from "express-session";
import passport from 'passport';
import { OAuth2Strategy } from 'passport-oauth';
import request from "request";
import handlebars from "handlebars";
import fs from 'fs';

const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_SECRET    = process.env.TWITCH_CLIENT_SECRET;
const SESSION_SECRET   = process.env.SESSION_SECRET || Math.random().toString(36);
const CALLBACK_URL     = 'http://localhost:8080/auth/twitch/callback';

OAuth2Strategy.prototype.userProfile = function(accessToken, done) {
    request({
        url: 'https://api.twitch.tv/helix/users',
        method: 'GET',
        headers: {
            'Client-ID': TWITCH_CLIENT_ID,
            'Authorization': 'Bearer ' + accessToken
        }
    }, function(error, response, body) {
        if (error) return done(error);
        if (response.statusCode == 200) {
            const parsed = JSON.parse(body);
            done(null, parsed.data[0]);
        } else {
            done(new Error(`API request failed with status ${response.statusCode}`));
        }
    });
}

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

passport.use('twitch', new OAuth2Strategy({
        authorizationURL: 'https://id.twitch.tv/oauth2/authorize',
        tokenURL: 'https://id.twitch.tv/oauth2/token',
        clientID: TWITCH_CLIENT_ID,
        clientSecret: TWITCH_SECRET,
        callbackURL: CALLBACK_URL,
        state: true
    },
    function(accessToken, refreshToken, profile, done) {
        profile.accessToken = accessToken;
        profile.refreshToken = refreshToken;
        fs.writeFileSync("./twitch_auth.json", JSON.stringify(profile, null, 2));
        console.log('✅ Tokens saved to twitch_auth.json!');
        done(null, profile);
    }
));

const app = express();
app.use(session({ secret: SESSION_SECRET, resave: false, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());

app.get('/auth/twitch', passport.authenticate('twitch', {
    scope: ['user_read', 'user:read:chat', 'user:write:chat', 'moderator:read:chatters', 'channel:read:redemptions'].join(' ')
}));

app.get('/auth/twitch/callback', passport.authenticate('twitch', {
    successRedirect: '/',
    failureRedirect: '/?error=auth_failed'
}));

app.get('/', (req, res) => {
    if (req.session?.passport?.user) {
        res.send(`<h1>✅ Auth successful! Tokens saved to twitch_auth.json. You can close this.</h1>`);
    } else {
        res.send(`<h1>Twitch Auth</h1><a href="/auth/twitch"><img src="http://ttv-api.s3.amazonaws.com/assets/connect_dark.png"></a>`);
    }
});

app.listen(8080, () => {
    console.log('Auth server running at http://localhost:8080');
    console.log('Visit http://localhost:8080/auth/twitch to authenticate');
});
