import CodeRunner from './helpers/run.js'
import dotenv from 'dotenv'
import rabbit from './helpers/rabbit.js'
import redisClient from './helpers/redis.js'
import * as Sentry from '@sentry/node'

dotenv.config()
Sentry.init({
	dsn: process.env.SENTRY_DSN,
	tracesSampleRate: 1.0
})

const codeRunner = new CodeRunner()

const runWorker = async () => {
	try {
		console.log('Starting worker')
		await rabbit.connect()
		const { channel } = rabbit
		await rabbit.channel.assertQueue('MS_TM_Q')
		await rabbit.consume('MS_TM_Q', async (msg, message) => {
			console.log('Consuming message')
			try {
				if (message === null) {
					console.log('Message is null')
					return
				}
				const { code, lang, id } = message
				const { stdout, stderr } = await codeRunner.runCode(code, lang)
				const result = stdout ? stdout : stderr
				const output = {
					result,
					status: 'completed'
				}
				console.log('Output', output)
				await redisClient.set(id, JSON.stringify(output))
			} catch (error) {
				console.log('Error', error)
				if (process.env.NODE_ENV === 'production') {
					Sentry.captureException(error)
				}
			} finally {
				channel.ack(msg)
				console.log('Message acknowledged')
			}
		})
	} catch (error) {
		console.log('Error', error)
		if (process.env.NODE_ENV === 'production') {
			Sentry.captureException(error)
		}
	}
}

runWorker()
