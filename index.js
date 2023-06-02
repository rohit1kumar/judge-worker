import CodeRunner from './helpers/run.js'
import dotenv from 'dotenv'
import rabbit from './helpers/rabbit.js'
import redisClient from './helpers/redis.js'

dotenv.config()

const codeRunner = new CodeRunner()

const runCode = async () => {
	await rabbit.connect()
	console.log('connected')
	const { channel } = rabbit
	await rabbit.channel.assertQueue('MS_TM_Q')
	await rabbit.consume('MS_TM_Q', async (msg, message) => {
		try {
			if (message === null) {
				return
			}
			const { code, lang, id } = message
			const output = await codeRunner.runCode(code, lang)
			console.log('output', output)
			await redisClient.set(id, output)
		} catch (error) {
			console.log(error)
		} finally {
			channel.ack(msg)
		}
	})
}

runCode()
