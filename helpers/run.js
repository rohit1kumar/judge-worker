import { exec } from 'child_process'
import { promises as fs } from 'fs'
import { v4 as uuidv4 } from 'uuid'

class CodeRunner {
	constructor() {
		this.LANGUAGES = {
			py: {
				dockerImage: 'python:3.9-slim',
				command: (filename) => `python ${filename}; rm ${filename}`
			},
			js: {
				dockerImage: 'node:14-alpine',
				command: (filename) => `node ${filename}; rm ${filename}`
			},
			cpp: {
				dockerImage: 'gcc:9.2.0',
				command: (filename) =>
					`g++ ${filename} -o output && { ./output; exitcode=$?; } || exitcode=$?; rm -f ${filename} output; exit $exitcode`
			},
			java: {
				dockerImage: 'openjdk:11',
				command: (filename) => {
					const className = filename.split('.').slice(0, -1).join('.')
					return `javac ${filename} && java ${className}`
				}
			}
		}
	}

	getLanguageDetails(language) {
		const details = this.LANGUAGES[language]
		if (!details) {
			throw new Error('Unsupported language')
		}
		return details
	}

	executeCommand(command) {
		return new Promise((resolve, reject) => {
			exec(command, (error, stdout, stderr) => {
				// Handle the system error
				if (error) {
					reject({
						error: true,
						message: 'An unexpected system error occurred.',
						systemError: error.message
					})
					return
				}

				// Always resolve with both stdout and stderr
				resolve({ stdout, stderr })
			})
		})
	}

	async runCode(code, language) {
		// Determine the Docker image and command based on the language
		const { dockerImage, command } = this.getLanguageDetails(language)

		// Create a unique filename
		const filename = `${uuidv4()}.${language}`

		try {
			await fs.writeFile(filename, code)
			const dockerCommand = `docker run --rm -v $(pwd):/usr/src/app -w /usr/src/app ${dockerImage} /bin/sh -c "${command(
				filename
			)}"`
			const { stdout, stderr } = await this.executeCommand(dockerCommand)
			return { stdout, stderr }
		} catch (error) {
			return error
		}
	}
}

export default CodeRunner
