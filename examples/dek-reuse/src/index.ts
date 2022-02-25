import {SDK, DeviceDetails, initialize} from "@ironcorelabs/ironnode"
import * as crypto from "crypto"
import * as fs from "fs"


const AES_ALGORITHM = "aes-256-gcm"
const AES_SYMMETRIC_KEY_LENGTH = 32
const AES_IV_LENGTH = 12
const AES_GCM_TAG_LENGTH = 16
    
const DATA_BLOCK_LENGTH = 256
const NUM_DATA_BLOCKS = 3
    

async function writeDataFile(dek: Buffer, fileNum: number) {
    const dataBlock = crypto.randomBytes(DATA_BLOCK_LENGTH).toString("base64")
    const iv = crypto.randomBytes(AES_IV_LENGTH)
    const cipher = crypto.createCipheriv(AES_ALGORITHM, dek, iv)
    const encryptedData =
          Buffer.concat([iv, cipher.update(dataBlock), cipher.final(), cipher.getAuthTag()])
    const dataBlockFname = `./dataFile${fileNum}.txt`
    fs.writeFileSync(dataBlockFname, dataBlock)
    const encDataFname = `./dataFile${fileNum}.enc`
    fs.writeFileSync(encDataFname, encryptedData)
}


async function writeInitialData(ironnode: SDK) {
    // Generate a random AES key to use to encrypt multiple blocks of data. We refer to this as
    // the "Data Encryption Key", or DEK.
    const dek = crypto.randomBytes(AES_SYMMETRIC_KEY_LENGTH)
    
    // Now generate some blocks of data to encrypt. Each one is just random bytes which are
    // base64 encoded so it's easier to look at them. For each one, generate a random IV
    // (initialization vector), then encrypt the block using AES256-GCM with the provided key
    // and the IV. Write each input data block to its own file, then write the encrypted block
    // to a corresponding file.
    for (let i = 0; i < NUM_DATA_BLOCKS; i++) {
        await writeDataFile(dek, i)
    }
    
    // Now encrypt the AES key using ironnode. We don't pass in any document options - it defaults
    // to an empty document name, random document ID, and encrypting only to the current user -
    // you could encrypt to additional users or groups if desired. Persist this along with the
    // encrypted data files.
    const edekResponse = await ironnode.document.encryptBytes(dek)
    fs.writeFileSync(`./edek`, edekResponse.document)
}


// We'll just do a quick check to make sure that we have the right DEK - decrypt the first
// encrypted data file and compare it with the unencrypted one.
async function checkDek(dek: Buffer, fileNum: number) {
    fs.accessSync(`./dataFile${fileNum}.enc`, fs.constants.R_OK)
    const edataFile = fs.readFileSync(`./dataFile${fileNum}.enc`)
    fs.accessSync(`./dataFile${fileNum}.txt`, fs.constants.R_OK)
    const dataFile = fs.readFileSync(`./dataFile${fileNum}.txt`)
    const dataIv = edataFile.slice(0, AES_IV_LENGTH)
    const dataEncryptedBytes = edataFile.slice(AES_IV_LENGTH, edataFile.length - AES_GCM_TAG_LENGTH)
    const dataGcmTag = edataFile.slice(edataFile.length - AES_GCM_TAG_LENGTH)
    const decryptCipher = crypto.createDecipheriv(AES_ALGORITHM, dek, dataIv)
    decryptCipher.setAuthTag(dataGcmTag)
    const decryptedData = Buffer.concat([decryptCipher.update(dataEncryptedBytes), decryptCipher.final()])

    if (Buffer.compare(dataFile, decryptedData))
        throw new Error('Did not get the correct DEK to decrypt a data file.')
}


(async () => {
    const configPath = "../.device_keys"
    fs.accessSync(configPath, fs.constants.R_OK)
    const deviceKeys: DeviceDetails = JSON.parse(fs.readFileSync(configPath, "utf8"))
    
    const ironnode = await initialize(deviceKeys.accountID, deviceKeys.segmentID,
               deviceKeys.deviceKeys.privateKey,
               deviceKeys.signingKeys.privateKey)

    await writeInitialData(ironnode)

    // Now assume that we are in a new state of the app where we don't have the DEK and want to
    // encrypt additional data items that go with the others. We will get the encrypted DEK,
    // decrypt it, and use the DEK to encrypt some new items.
    fs.accessSync(`./edek`, fs.constants.R_OK)
    const edek: Buffer = fs.readFileSync(`./edek`)
    const docId = await ironnode.document.getDocumentIDFromBytes(edek)
    const decryptResponse = await ironnode.document.decryptBytes(docId, edek)
    const dek = decryptResponse.data

    await checkDek(dek, 0)

    // Create one more data file and encrypt it with the same DEK.
    await writeDataFile(dek, NUM_DATA_BLOCKS)
    await checkDek(dek, NUM_DATA_BLOCKS)

})()
