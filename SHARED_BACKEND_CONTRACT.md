# MST Score shared-backend contract

- Production origin: `https://myanmarsportstalk.com`
- API base: `https://myanmarsportstalk.com/api`
- Authentication: revocable MST session in SecureStore, sent by `Authorization: Bearer`; the server resolves the canonical profile UUID.
- Profile, favorites, follows, predictions, leaderboard, tips, wallet, orders, notification preferences/history and push registrations are server resources. AsyncStorage is not authoritative for them.
- Football and articles come only from MST endpoints. The App contains no D1 binding, Cloudflare credential or football-provider secret.
- Credit packages are shown only when the backend explicitly returns `purchasingEnabled: true` and at least one server-verified provider with `enabled: true`.
- App logout removes only the current device push token and then revokes the current MST session.
- Server errors/unavailable football data remain explicit; the App must not fabricate payment success, scores, events, lineups, statistics or standings.
