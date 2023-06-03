import CodeRunner from './helpers/run.js';
import dotenv from 'dotenv';
import rabbit from './helpers/rabbit.js';
import redisClient from './helpers/redis.js';
import * as Sentry from "@sentry/node";

dotenv.config();

Sentry.init({
	dsn: process.env.SENTRY_DSN,
	tracesSampleRate: 1.0,
});

class Worker {
	constructor() {
		this.codeRunner = new CodeRunner();
		this.queueName = 'MS_TM_Q';
	}

	async start() {
		console.log('Starting worker');
		await this.connectToRabbitMQ();
		await this.consumeMessages();
	}

	async connectToRabbitMQ() {
		await rabbit.connect();
		await rabbit.channel.assertQueue(this.queueName);
	}

	async consumeMessages() {
		await rabbit.consume(this.queueName, async (msg, message) => {
			console.log('Consuming message');
			if (message === null) {
				console.log('Message is null');
				return;
			}

			await this.processMessage(msg, message);
		});
	}

	async processMessage(msg, message) {
		try {
			const { code, lang, id } = message;
			const { stdout, stderr } = await this.codeRunner.runCode(code, lang);
			const result = stdout ? stdout : stderr;
			await this.storeResult(id, result);
		} catch (error) {
			console.log('Error', error);
			if (process.env.NODE_ENV === 'production') {
				Sentry.captureException(error);
			}
		} finally {
			rabbit.channel.ack(msg);
			console.log('Message acknowledged');
		}
	}

	async storeResult(id, result) {
		const output = {
			result,
			status: 'completed'
		};
		console.log('Output', output);
		await redisClient.set(id, JSON.stringify(output));
	}
}

const worker = new Worker();
worker.start();
