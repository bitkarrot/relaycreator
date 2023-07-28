This is the relay creator for #nostr app repository.

## Getting Started

First, copy and configure the example .env:
The required settings right now are mysql and lnbits.
The rest can be left as default.

```bash
cp env.develop .env
```

Next, run the development server:

```bash
npm install
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## TODO:
There is much to do, I know.  If you're interested in helping with the project let me know!

- [ ] Create a docker-compose setup for easy development
- [ ] Make development possible w/out LNBITS
- [ ] Add more documentation
- [ ] UI tweaks for responsive/mobile
- [ ] Login via mobile DM
- [ ] Fix flicker on theme switch
- [ ] Relay directory and advertisement
- [ ] ...