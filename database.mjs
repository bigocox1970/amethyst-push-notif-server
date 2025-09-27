import { pgPool } from './database-config.mjs'
import format from 'pg-format'

export async function initializeDatabase() {
    try {
        await pgPool.query(`
            CREATE TABLE IF NOT EXISTS subscriptions (
                ID SERIAL PRIMARY KEY,
                PUB_KEY VARCHAR(255) NOT NULL,
                RELAY VARCHAR(255) NOT NULL,
                TOKEN VARCHAR(255) NOT NULL,
                UNIQUE (PUB_KEY, RELAY, TOKEN)
            );
        `);
        console.log('✅ Database initialized successfully');
    } catch (error) {
        console.error('❌ Failed to initialize database:', error);
        throw error;
    }
}

export async function getTokensByPubKey(pubkey) {
    const result = await pgPool.query(
        `SELECT DISTINCT TOKEN AS token, MAX(ID) as max_id
         FROM subscriptions
         WHERE PUB_KEY = $1
         GROUP BY TOKEN
         ORDER BY max_id DESC`,
        [pubkey]
    );

    if (!result || !result.rows || !result.rows.length) return [];

    let tokens = []
    for (let row of result.rows) {
        tokens.push(row.token)
    }
    return tokens
}

export async function getAllKeys() {
    const result = await pgPool.query(
        `SELECT DISTINCT PUB_KEY AS key
         FROM subscriptions
        `
    )
    if (!result || !result.rows || !result.rows.length) return [];

    let keys = []
    for (let row of result.rows) {
        keys.push(row.key)
    }
    return keys
}

export async function getAllRelays() {
    const result = await pgPool.query(
        `SELECT RTRIM(TRIM(RELAY),'/') AS relay, COUNT(*) AS votes
        FROM subscriptions 
        group by RTRIM(TRIM(RELAY),'/')
        order by votes desc
        `
    )

    if (!result || !result.rows || !result.rows.length) return [];

    let relays = []
    for (let row of result.rows) {
        relays.push(row.relay)
    }
    return relays
}

export async function registerInDatabase(pubkey, relays, token) {
    for (let relay of relays) {
        pgPool.query(
            `INSERT INTO subscriptions (PUB_KEY, RELAY, TOKEN) 
            VALUES ($1, $2, $3) 
            ON CONFLICT (PUB_KEY, RELAY, TOKEN) 
            DO NOTHING;
            `,
            [pubkey, relay || null, token],
            (err, res) => {
                if (err) {
                    console.log("Database Insert: " + err)
                }
            }
        )
    }
}

export async function registerInDatabaseTuples(pubkeyRelaysTokenTuples) {
    pgPool.query(
        format(
            `INSERT INTO subscriptions (PUB_KEY, RELAY, TOKEN) 
            VALUES %L 
            ON CONFLICT (PUB_KEY, RELAY, TOKEN) 
            DO NOTHING;
            `, pubkeyRelaysTokenTuples
        ),
        [],
        (err, res) => {
            if (err) {
                console.log("Multi Database Insert: " + err)
            }
        }
    )
}

export async function deleteToken(token) {
    pgPool.query(
        `DELETE from subscriptions 
         WHERE TOKEN = $1
        `,
        [token],
        (err, res) => {
            if (err) {
                console.log("Delete Token Error: " + err)
            }
            if (res) {
                console.log("Token Deleted: " + token)
            }
        }
      )
}

export async function deleteRelay(relayUrl) {
    pgPool.query(
        `DELETE from subscriptions 
         WHERE rtrim(TRIM(RELAY),'/') = $1
        `,
        [relayUrl],
        (err, res) => {
            if (err) {
                console.log("Delete Relay Error: " + err)
            }
            if (res) {
                console.log("Relay Deleted: " + relayUrl)
            }
        }
      )
}


export async function checkIfPubKeyExists(pubkey) {
    const result = await pgPool.query(
        `SELECT COUNT(*) AS instances
         FROM subscriptions
         WHERE PUB_KEY = $1
        `,
        [pubkey]
    );

    if (!result || !result.rows || !result.rows.length) return [];
    return result.rows[0].instances && result.rows[0].instances > 0
}

export async function checkIfRelayExists(relay) {
    const result = await pgPool.query(
        `SELECT COUNT(*) AS instances
         FROM subscriptions
         WHERE RELAY = $1
        `,
        [relay]
    );

    if (!result || !result.rows || !result.rows.length) return [];
    return result.rows[0].instances && result.rows[0].instances > 0
}

export async function checkIfThereIsANewRelay(relayList) {
    const result = await pgPool.query(
        format(
            `VALUES %L
            EXCEPT ALL 
            SELECT RELAY from subscriptions
            `,
            relayList.map( url => [url])
        ),
        []
    );

    if (!result || !result.rows || !result.rows.length) return false;

    return result.rows.length > 0
}