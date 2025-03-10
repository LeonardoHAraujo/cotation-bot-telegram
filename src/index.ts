import axios from 'axios';
import TelegramBot from 'node-telegram-bot-api';
import * as dotenv from 'dotenv';
import * as schedule from 'node-schedule';

dotenv.config();

// Configs
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN!;
const CHAT_ID = process.env.CHAT_ID!;
const PRICE_CHECK_INTERVAL = 60000; // 1 minute

const CRYPTO_API_URL = 'https://api.coingecko.com/api/v3/simple/price';
const AWESOME_API_URL = 'https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL';
const TELEGRAM_API_URL = 'https://api.telegram.org';
const THRESHOLD = 2;

let isActive = true;

interface Prices {
  bitcoin: number;
  ethereum: number;
  solana: number;
  trump: number;
  binancecoin: number;
  dogecoin: number;
  xrp: number;
  usd: number;
  eur: number;
}

const bot = new TelegramBot(TELEGRAM_TOKEN, {
  polling: true,
  request: {
    url: TELEGRAM_API_URL,
    agentOptions: {
      keepAlive: true,
      family: 4
    },
  }
});

let lastPrices: Prices | null = null;

async function fetchPrices(): Promise<Prices> {
  const [cryptoResponse, awesomeResponse] = await Promise.all([
    axios.get(CRYPTO_API_URL, { params: { ids: 'bitcoin,ethereum,solana,official-trump,ripple,binancecoin,dogecoin', vs_currencies: 'brl' } }),
    axios.get(AWESOME_API_URL),
  ]);

  const bitcoin = cryptoResponse.data.bitcoin.brl;
  const ethereum = cryptoResponse.data.ethereum.brl;
  const solana = cryptoResponse.data.solana.brl;
  const trump = cryptoResponse.data['official-trump'].brl;
  const binancecoin = cryptoResponse.data.binancecoin.brl;
  const dogecoin = cryptoResponse.data.dogecoin.brl;
  const xrp = cryptoResponse.data.ripple.brl;
  const usd = awesomeResponse.data['USDBRL'].ask;
  const eur = awesomeResponse.data['EURBRL'].ask;

  return { bitcoin, ethereum, solana, trump, binancecoin, dogecoin, xrp, usd, eur };
}

/**
 * Calculate the percentage change between two prices.
 * Returns a positive value for price increases and a negative value for price decreases.
 */
function calculateChange(newPrice: number, oldPrice: number): number {
  return ((newPrice - oldPrice) / oldPrice) * 100;
}

function buildAlertMessage(changes: Partial<Prices>): string {
  const messages: string[] = [];
  if (changes.bitcoin) messages.push(`🔸 Bitcoin mudou ${changes.bitcoin.toFixed(2)}%`);
  if (changes.ethereum) messages.push(`🔹 Ethereum mudou ${changes.ethereum.toFixed(2)}%`);
  if (changes.solana) messages.push(`🔹 Solana mudou ${changes.solana.toFixed(2)}%`);
  if (changes.binancecoin) messages.push(`🔹 BNB mudou ${changes.binancecoin.toFixed(2)}%`);
  if (changes.trump) messages.push(`🔹 Trump mudou ${changes.trump.toFixed(2)}%`);
  if (changes.xrp) messages.push(`🔹 XRP mudou ${changes.xrp.toFixed(2)}%`);
  if (changes.dogecoin) messages.push(`🔹 Dogecoin mudou ${changes.dogecoin.toFixed(2)}%`);
  if (changes.usd) messages.push(`💵 Dólar mudou ${changes.usd.toFixed(2)}%`);
  if (changes.eur) messages.push(`💵 Euro mudou ${changes.eur.toFixed(2)}%`);
  return messages.join('\n');
}

function buildReportAlertMessage(prices: Prices): string {
  const messages: string[] = [];
  if (prices.bitcoin) messages.push(`🔸Cotação Bitcoin R$ ${prices.bitcoin.toFixed(2)}`);
  if (prices.ethereum) messages.push(`🔹Cotação Ethereum R$ ${prices.ethereum.toFixed(2)}`);
  if (prices.solana) messages.push(`🔹Cotação Solana R$ ${prices.solana.toFixed(2)}`);
  if (prices.binancecoin) messages.push(`🔹Cotação Binancecoin R$ ${prices.binancecoin.toFixed(2)}`);
  if (prices.trump) messages.push(`🔹Cotação Trump R$ ${prices.trump.toFixed(2)}`);
  if (prices.xrp) messages.push(`🔹Cotação XRP R$ ${prices.xrp.toFixed(2)}`);
  if (prices.dogecoin) messages.push(`🔹Cotação Dogecoin R$ ${prices.dogecoin.toFixed(2)}`);
  if (prices.usd) messages.push(`💵 Cotação Dólar R$ ${Number(prices.usd).toFixed(2)}`);
  if (prices.eur) messages.push(`💵 Cotação Euro R$ ${Number(prices.eur).toFixed(2)}`);
  return messages.join('\n');
}

async function reportCotation() {
  try {
    if (!isActive) {
      return;
    }

    const currentPrices = await fetchPrices();
    const message = buildReportAlertMessage(currentPrices);
    bot.sendMessage(CHAT_ID, `📊 Relatório de preços:\n\n${message}`);
  } catch (error) {
    console.error('Erro ao enviar relatório:', error);
    bot.sendMessage(CHAT_ID, '❌ Ocorreu um erro ao enviar o relatório.');
  }
}

async function monitorPrices() {
  try {
    if (!isActive) {
      return;
    }

    const currentPrices = await fetchPrices();

    if (lastPrices) {
      const changes: Partial<Prices> = {};

      if (Math.abs(calculateChange(currentPrices.bitcoin, lastPrices.bitcoin)) >= THRESHOLD) {
        changes.bitcoin = calculateChange(currentPrices.bitcoin, lastPrices.bitcoin);
      }
      if (Math.abs(calculateChange(currentPrices.ethereum, lastPrices.ethereum)) >= THRESHOLD) {
        changes.ethereum = calculateChange(currentPrices.ethereum, lastPrices.ethereum);
      }
      if (Math.abs(calculateChange(currentPrices.solana, lastPrices.solana)) >= THRESHOLD) {
        changes.solana = calculateChange(currentPrices.solana, lastPrices.solana);
      }
      if (Math.abs(calculateChange(currentPrices.usd, lastPrices.usd)) >= THRESHOLD) {
        changes.usd = calculateChange(currentPrices.usd, lastPrices.usd);
      }
      if (Math.abs(calculateChange(currentPrices.eur, lastPrices.eur)) >= THRESHOLD) {
        changes.eur = calculateChange(currentPrices.eur, lastPrices.eur);
      }

      if (Object.keys(changes).length > 0) {
        const message = buildAlertMessage(changes);
        bot.sendMessage(CHAT_ID, `⚠️  Alerta de variação de preços:\n\n${message}`);
      }
    }

    lastPrices = currentPrices;
  } catch (error) {
    console.error('Erro ao monitorar preços:', error);
    bot.sendMessage(CHAT_ID, '❌ Ocorreu um erro ao monitorar os preços.');
  }
}

// Start monitoring. Every 2 hours.
schedule.scheduleJob('0 */2 * * *', async (): Promise<void> => reportCotation());
setInterval(monitorPrices, PRICE_CHECK_INTERVAL);

bot.on('message', async (msg) => {
  if (msg.text?.toLowerCase() === '/active') {
    bot.sendMessage(CHAT_ID, 'Bot ativado!');
    isActive = true;
  }

  if (msg.text?.toLowerCase() === '/deactive') {
    bot.sendMessage(CHAT_ID, 'Bot desativado!');
    isActive = false;
  }

  if (msg.text?.toLowerCase() === '/report') {
    if (!isActive) {
      bot.sendMessage(CHAT_ID, `⚠️  Bot inativo! Ativar? /active`);
      return;
    }

    await reportCotation();
  }

  if (msg.text?.toLowerCase() === '/ping') {
    if (!isActive) {
      bot.sendMessage(CHAT_ID, `⚠️  Bot inativo! Ativar? /active`);
      return;
    }

    bot.sendMessage(
      msg.chat.id,
      '🤖 Pong!. 📊'
    );
  }
});

console.log('Bot iniciado...');
