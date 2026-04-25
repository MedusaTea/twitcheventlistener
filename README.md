Create Application on dev.twitch.com 

Set oauth url calllback to http://localhost:8080/auth/twitch/callback

Make sure it's check as Confidential, not Public

Client ID and Secret will be found here

User_ID is not your channel name, but the channel id

Fill this out

.env template  

TWITCH_CLIENT_SECRET=xxxx  
TWITCH_CLIENT_ID=xxxxx  
USER_ID=xxxx  



This will be populated after running npm run auth.js

twitch_auth.json template

{  
  "id": "xxxxx",  
  "login": "xxxxx",  
  "display_name": "xxxxx",  
  "type": "",  
  "broadcaster_type": "affiliate",  
  "description": "xxxxxx",  
  "profile_image_url": "xxxx",  
  "offline_image_url": "",  
  "view_count": 0,  
  "email": "xxxx",  
  "created_at": "xxxxx",  
  "accessToken": "xxxxx",  
  "refreshToken": "xxxxx",  
  "validated_at": "xxxxx",  
}  
