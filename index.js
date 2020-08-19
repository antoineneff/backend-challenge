const fs = require('fs')
const got = require('got')

// .env file
const API_URL = 'http://localhost:3000'
const clientId = 'BankinClientId'
const clientSecret = 'secret'

/**
 * @description Get refresh token
 * @param {string} login
 * @param {string} password
 * @return {string} Refresh token
 */
async function login(login, password) {
    const base64 = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
    const response = await got.post(`${API_URL}/login`, {
        headers: {
            Authorization: `Basic ${base64}`
        },
        json: {
            'user': login,
            'password': password
        }
    }).json()

    return response.refresh_token
}

/**
 * @description Get access token
 * @param {string} refreshToken
 * @return {string} Access token
 */
async function getAccessToken(refreshToken) {
    const response = await got.post(`${API_URL}/token`, {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        form: {
            grant_type: 'refresh_token',
            refresh_token: refreshToken
        }
    }).json()

    return response.access_token
}

/**
 * @description GET request to api
 * @param {string} url
 * @param {string} accessToken
 * @return {Object} Api response
 */
async function getApi(url, accessToken) {
    const response = await got(`${API_URL}${url}`, {
        headers: {
            Authorization: `Bearer ${accessToken}`
        }
    }).json()

    return response
}

/**
 * @description Get the list of accounts
 * @param {string} accessToken
 * @return {Array} Accounts list
 */
async function getAccounts(accessToken) {
    let accounts = new Map()
    let nextPageUrl = '/accounts'

    while(nextPageUrl !== null) {
        const response = await getApi(nextPageUrl, accessToken)
        for (const account of response.account) {
            if (!accounts.has(account.acc_number)) {
                accounts.set(account.acc_number, account)
            }
        }
        nextPageUrl = response.link && response.link.next
    }

    return Array.from(accounts.values())
}

/**
 * @description Get the list of transactions from an account
 * @param {string} accountNumber
 * @param {string} accessToken
 * @return {Array} Transactions list
 */
async function getAccountTransactions(accountNumber, accessToken) {
    try {
        let transactions = new Map()
        let nextPageUrl = `/accounts/${accountNumber}/transactions`

        while(nextPageUrl !== null) {
            const response = await getApi(nextPageUrl, accessToken)
            for (const transaction of response.transactions) {
                if (!transactions.has(transaction.id)) {
                    transactions.set(transaction.id, transaction)
                }
            }
            nextPageUrl = response.link && response.link.next
        }

        return Array.from(transactions.values())
    } catch (err) {
        return []
    }
}

(async () => {
    try {
        // AUTHENTICATION
        const refreshToken = await login('BankinUser', '12345678')
        const accessToken = await getAccessToken(refreshToken)

        // GET ACCOUNTS
        const accounts = await getAccounts(accessToken)

        // GET ALL TRANSACTIONS AND FORMAT DATA
        let formattedData = []
        for (const account of accounts) {
            const { acc_number, amount } = account
            const accountTransactions = await getAccountTransactions(acc_number, accessToken)

            formattedData.push({
                acc_number,
                amount,
                transactions: accountTransactions.map(({ label, amount, currency}) => ({ label, amount, currency }))
            })
        }

        // WRITING DATA TO JSON FILE (SYNC BECAUSE NOTHING MORE TO DO)
        fs.writeFileSync('data.json', JSON.stringify(formattedData, null, 2), 'utf8', (error) => {
            throw error
        })
    } catch (error) {
        console.log({ error })
    }
})()

// 7. Que ferais-tu pour améliorer le serveur ?
// - Gérer les doublons (pages des comptes 3+ similaires)
// - Fixer la donnée (account number 0000000013, dans les transactions 000000013 (manque un 0))
// Utilisation des body parser intégrés à Express : `express.json()` et `express.urlencoded()` au lieu d'importer body-parser
