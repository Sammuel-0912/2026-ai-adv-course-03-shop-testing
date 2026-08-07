import http from 'node:http'

const port = Number(process.env.FAKE_ECPAY_PORT ?? 3102)

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = ''
    request.setEncoding('utf8')
    request.on('data', (chunk) => {
      body += chunk
    })
    request.on('end', () => resolve(body))
    request.on('error', reject)
  })
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

const server = http.createServer(async (request, response) => {
  if (request.method === 'GET' && request.url === '/health') {
    response.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end('ok')
    return
  }

  if (request.method === 'POST' && request.url === '/Cashier/AioCheckOut/V5') {
    const params = new URLSearchParams(await readBody(request))
    const orderResultUrl = params.get('OrderResultURL')
    const merchantTradeNo = params.get('MerchantTradeNo')

    if (!orderResultUrl || !merchantTradeNo) {
      response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' })
      response.end('missing payment fields')
      return
    }

    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    response.end(`<!doctype html>
<html lang="zh-Hant">
  <head><meta charset="utf-8"><title>模擬綠界付款</title></head>
  <body>
    <p>模擬付款成功，正在返回商店…</p>
    <form id="payment-result" method="post" action="${escapeHtml(orderResultUrl)}">
      <input type="hidden" name="MerchantTradeNo" value="${escapeHtml(merchantTradeNo)}">
    </form>
    <script>document.getElementById('payment-result').submit()</script>
  </body>
</html>`)
    return
  }

  if (
    request.method === 'POST' &&
    request.url === '/Cashier/QueryTradeInfo/V5'
  ) {
    response.writeHead(200, {
      'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
    })
    response.end('TradeStatus=1&RtnMsg=Paid')
    return
  }

  response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
  response.end('not found')
})

server.listen(port, '127.0.0.1', () => {
  console.log(`Fake ECPay listening on http://127.0.0.1:${port}`)
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0))
  })
}
