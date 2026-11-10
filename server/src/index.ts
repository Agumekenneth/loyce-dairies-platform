
import 'dotenv/config'
import app from './app.js'

const port = Number(process.env.PORT ?? 5000)

if (
  !Number.isInteger(port) ||
  port < 1 ||
  port > 65535
) {
  throw new Error('Invalid server PORT configuration')
}

app.listen(port, () => {
  console.log('----------------------------------')
  console.log('Loyce Dairies API')
  console.log(`Server: http://localhost:${port}`)
  console.log(`Health: http://localhost:${port}/api/health`)
  console.log('----------------------------------')
})
