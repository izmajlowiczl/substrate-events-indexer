const {ApiPromise} = require('@polkadot/api');
const {Client} = require('pg');

const coreSection = "templateModule"

// Supported Events
const EventType = {
    CollectionCreated: 'CollectionCreated',
    CollectionDestroyed: "CollectionDestroyed",
    AssetCreated: "AssetCreated",
    NftCreated: "NftCreated",
    NftBurnt: "NftBurnt",
    NftFrozen: "NftFrozen",
    NftThawed: "NftThawed",
}


async function main() {
    const pgClient = await connectToStorageOrThrow(
        "postgres",
        "my_password",
        54320)

    const api = await ApiPromise.create();

    api.query.system.events(events => {
            console.log(`\nReceived ${events.length} events:`);
            events.forEach(async (event) => await handleNewEvent(event, pgClient));
        }
    )
}

async function handleNewEvent(event, pgClient) {
    if (event.section === coreSection) {
        const raw = event.data.toJSON();
        
        const what = event.method
        const account = raw[0]
        const extras = extractExtras(event)

        await persist(
            what,
            account,
            extras,
            pgClient)
    }
}

async function extractExtras(event) {
    const raw = event.data.toJSON();
    switch (event.method) {
        case EventType.CollectionCreated:
            // CollectionCreated { who: T::AccountId, id: T::AssetId },
            return {
                id: raw[1]
            };
        case EventType.CollectionDestroyed:
            // CollectionDestroyed { who: T::AccountId, id: T::CollectionId },
            return {
                lot: raw[1]
            };
        case EventType.AssetCreated:
            // AssetCreated { who: T::AccountId, id: T::AssetId, quantity: T::Balance },
            return {
                id: raw[1],
                quantity: raw[2]
            };
        case EventType.NftCreated:
            // NftCreated { who: T::AccountId, collection: T::CollectionId, asset: T::NftId },
            return {
                id: raw[1],
                box: raw[2]
            };
        case EventType.NftBurnt:
            // NftBurnt { who: T::AccountId, collection: T::CollectionId, asset: T::NftId },
            return  {
                id: raw[1],
                box: raw[2]
            };
        case EventType.NftFrozen:
            // NftFrozen { who: T::AccountId, collection: T::CollectionId, asset: T::NftId },
            return {
                id: raw[1],
                box: raw[2]
            };
        case EventType.NftThawed:
            //NftThawed { collection: T::CollectionId, asset: T::NftId },
            return {
                lot: raw[0],
                box: raw[1]
            };
        default:
            console.error(`Unsupported event type: ${event.method}`)
    }
}

async function persist(what, who, extras, pgClient) {
    try {
        await pgClient.query(`INSERT INTO events(what, who, extras)
                              VALUES ($1, $2, $3)`, [what, who, extras]);
    } catch (e) {
        console.error(e);
    }
}

async function connectToStorageOrThrow(user, password, port) {
    const pgClient = new Client({
        user: user,
        password: password,
        port: port,
    });

    await pgClient.connect();
    return pgClient
}

main().catch((error) => {
    console.error(error);
    process.exit(-1);
});
