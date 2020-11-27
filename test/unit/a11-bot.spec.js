/*
  Unit tests for the bot.js library.
*/

const assert = require('chai').assert
const sinon = require('sinon')
const cloneDeep = require('lodash.clonedeep')

const BotLib = require('../../src/lib/bot')
let uut

const mockDataLib = require('./mocks/bot-mock')
let mockData

describe('#bot.js', () => {
  let sandbox

  beforeEach(() => {
    uut = new BotLib({ token: 'fakeToken', chatId: 'fakeId' })

    mockData = cloneDeep(mockDataLib)

    sandbox = sinon.createSandbox()
  })

  afterEach(() => sandbox.restore())

  describe('#constructor', () => {
    it('should throw error if Telegram token is not specified', () => {
      try {
        uut = new BotLib()

        assert.fail('Unexpected result')
      } catch (err) {
        assert.include(
          err.message,
          'Bot Telegram token must be passed as BOTTELEGRAMTOKEN environment variable.'
        )
      }
    })

    it('should throw error Telegram chat room ID is not specified', () => {
      try {
        uut = new BotLib({ token: 'mockToken' })

        assert.fail('Unexpected result')
      } catch (err) {
        assert.include(
          err.message,
          'Telegram chat room ID must be passed as CHATID environment variable.'
        )
      }
    })

    it('should accept Telegram properties passed as environment variables', () => {
      process.env.BOTTELEGRAMTOKEN = 'fakeToken'
      process.env.CHATID = 'fakeId'

      uut = new BotLib()

      assert.isOk(uut)
    })
  })

  describe('#processMsg', () => {
    it('should create a new tg-user model on first message from new room participant', async () => {
      // Mock database response when user is not found.
      sandbox.stub(uut.TGUser, 'findOne').resolves(null)

      // Mock bot so that it doesn't throw an error.
      sandbox.stub(uut.bot, 'deleteMessage').resolves()

      const result = await uut.processMsg(mockData.mockMsg)

      // Return value should reflect the expected code path.
      assert.equal(result, 1)
    })

    it('should delete the message of an unverified user', async () => {
      // Mock database response when user is not found.
      sandbox.stub(uut.TGUser, 'findOne').resolves(mockData.mockUnverifiedUser)

      // Mock bot so that it doesn't throw an error.
      sandbox.stub(uut.bot, 'deleteMessage').resolves()

      const result = await uut.processMsg(mockData.mockMsg)

      // Return value should reflect the expected code path.
      assert.equal(result, 2)
    })

    it('should ignore messages from verified users', async () => {
      // Mock database response when user is not found.
      sandbox.stub(uut.TGUser, 'findOne').resolves(mockData.mockVerifiedUser)

      const result = await uut.processMsg(mockData.mockMsg)

      // Return value should reflect the expected code path.
      assert.equal(result, 3)
    })

    it('should catch and report errors', async () => {
      // Force an error
      // sandbox.stub(uut.bot, 'sendMessage').resolves()
      // sandbox.stub(uut.bch, 'verifyMsg').resolves(true)
      sandbox.stub(uut.TGUser, 'findOne').rejects(new Error('test error'))

      const result = await uut.processMsg(mockData.mockMsg)

      assert.equal(result, undefined)
    })
  })

  describe('#verifyUser', () => {
    it('should return default message if input is not formatted correctly', async () => {
      // Mock calls to the bot.
      sandbox.stub(uut.bot, 'sendMessage').resolves()

      const result = await uut.verifyUser(mockData.invalidVerifyMsg1)
      // console.log('result: ', result)

      assert.equal(result, 0)
    })

    it('should return default message if signature could not be verified', async () => {
      // Mock calls to the bot.
      sandbox.stub(uut.bot, 'sendMessage').resolves()

      const result = await uut.verifyUser(mockData.invalidVerifyMsg2)
      // console.log('result: ', result)

      assert.equal(result, 1)
    })

    it('should notify if address does not meet threshold', async () => {
      // Mock to force the code path for this test.
      sandbox.stub(uut.bot, 'sendMessage').resolves()
      sandbox.stub(uut.bch, 'verifyMsg').resolves(true)
      sandbox.stub(uut.TGUser, 'findOne').resolves(mockData.mockUnverifiedUser)
      // Force merit to be below threshold
      sandbox.stub(uut.bch, 'getMerit').resolves(0.1)

      const result = await uut.verifyUser(mockData.validVerifyMsg)

      assert.equal(result, 3)
    })

    it('should send success message if threshold is met', async () => {
      // Mock to force the code path for this test.
      sandbox.stub(uut.bot, 'sendMessage').resolves()
      sandbox.stub(uut.bch, 'verifyMsg').resolves(true)
      sandbox.stub(uut.TGUser, 'findOne').resolves(mockData.mockUnverifiedUser)
      // Force merit to be below threshold
      sandbox.stub(uut.bch, 'getMerit').resolves(35000)

      const result = await uut.verifyUser(mockData.validVerifyMsg)

      assert.equal(result, 2)
    })

    it('should catch and report errors', async () => {
      // Force an error
      sandbox.stub(uut.bot, 'sendMessage').resolves()
      sandbox.stub(uut.bch, 'verifyMsg').resolves(true)
      sandbox.stub(uut.TGUser, 'findOne').rejects(new Error('test error'))

      const result = await uut.verifyUser(mockData.validVerifyMsg)

      assert.equal(result, undefined)
    })
  })

  describe('#help', () => {
    it('should return message when triggered', async () => {
      // Mock calls to the bot.
      sandbox.stub(uut.bot, 'sendMessage').resolves()

      const result = await uut.help(mockData.mockHelpCmd)
      // console.log('result: ', result)

      assert.equal(result, undefined)
    })
  })

  describe('#getmerit', () => {
    it('should return 0 when user is not found', async () => {
      // Mock calls to the bot.
      sandbox.stub(uut.bot, 'sendMessage').resolves()

      // Force 'user not found'
      sandbox.stub(uut.TGUser, 'findOne').resolves(null)

      const result = await uut.getMerit(mockData.getMeritUserNotFound)
      // console.log('result: ', result)

      assert.equal(result, 0)
    })

    it('should return 0 for invalid arguments', async () => {
      // Mock calls to the bot.
      sandbox.stub(uut.bot, 'sendMessage').resolves()

      // Force 'user not found'
      sandbox.stub(uut.TGUser, 'findOne').resolves(null)

      const result = await uut.getMerit(mockData.getMeritInvalidArgs)
      // console.log('result: ', result)

      assert.equal(result, 0)
    })

    it('should return 1 for unverified user', async () => {
      // Mock calls to the bot.
      sandbox.stub(uut.bot, 'sendMessage').resolves()

      // Force unverified user.
      sandbox.stub(uut.TGUser, 'findOne').resolves(mockData.mockUnverifiedUser)

      const result = await uut.getMerit(mockData.mockGetMeritMsg)
      // console.log('result: ', result)

      assert.equal(result, 1)
    })

    it('should return 1 for verified user', async () => {
      // Mock calls to the bot.
      sandbox.stub(uut.bot, 'sendMessage').resolves()

      // Force verified user
      sandbox.stub(uut.TGUser, 'findOne').resolves(mockData.mockVerifiedUser)

      const result = await uut.getMerit(mockData.mockGetMeritMsg)
      // console.log('result: ', result)

      assert.equal(result, 1)
    })

    it('should catch and report errors', async () => {
      // Force an error
      sandbox.stub(uut.TGUser, 'findOne').rejects(new Error('test error'))

      const result = await uut.getMerit(mockData.mockGetMeritMsg)

      assert.equal(result, undefined)
    })
  })
})
