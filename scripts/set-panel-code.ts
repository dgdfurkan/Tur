/**
 * Sets the access code of the operations panel.
 *
 *   npm run panel:code                 asks for a new code (typed twice, not shown)
 *   npm run panel:code -- --generate   makes a random code and saves it to erisim-kodu.txt
 *
 * Only a salted fingerprint of the code is written to src/config/panel-lock.json,
 * which is committed. The code itself is never stored in the repository.
 */
import { createHash, pbkdf2Sync, randomBytes, randomInt } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ITERATIONS = 310_000;
// Six digits is the shortest code the office uses, a PIN like a phone's.
const MIN_LENGTH = 6;
const LOCK_FILE = fileURLToPath(new URL('../src/config/panel-lock.json', import.meta.url));
const CODE_FILE = fileURLToPath(new URL('../erisim-kodu.txt', import.meta.url));
/** Letters and digits that are not mistaken for one another when read aloud or typed on a phone. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function writeLock(code: string): void {
  const salt = randomBytes(16);
  const key = pbkdf2Sync(code.trim().normalize('NFC'), salt, ITERATIONS, 32, 'sha256');
  const trimmed = code.trim();
  const lock = {
    salt: salt.toString('hex'),
    verifier: createHash('sha256').update(key).digest('hex'),
    iterations: ITERATIONS,
    // A code of digits only is typed on the number pad, and sent once complete.
    ...(/^\d+$/.test(trimmed) ? { digits: trimmed.length } : {}),
  };
  writeFileSync(LOCK_FILE, `${JSON.stringify(lock, null, 2)}\n`);
}

function randomCode(): string {
  const group = (): string =>
    Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
  return [group(), group(), group()].join('-');
}

function say(line: string): void {
  process.stdout.write(`${line}\n`);
}

/** Reads a line from the terminal without showing what is typed. */
function askHidden(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const { stdin, stdout } = process;
    if (!stdin.isTTY) {
      reject(new Error('Kod yalnızca etkileşimli bir terminalde sorulabilir.'));
      return;
    }
    stdout.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let typed = '';
    const onData = (chunk: string): void => {
      for (const char of chunk) {
        if (char === '\r' || char === '\n') {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off('data', onData);
          stdout.write('\n');
          resolve(typed);
          return;
        }
        if (char === '\u0003') process.exit(130);
        if (char === '\u007f' || char === '\b') typed = typed.slice(0, -1);
        else typed += char;
      }
    };
    stdin.on('data', onData);
  });
}

if (process.argv.includes('--generate')) {
  const code = randomCode();
  writeLock(code);
  writeFileSync(CODE_FILE, `${code}\n`, { mode: 0o600 });
  say('Yeni erişim kodu üretildi ve erisim-kodu.txt dosyasına yazıldı.');
  say('Bu dosya depoya eklenmez. Kodu not ettikten sonra dosyayı silebilirsiniz.');
} else {
  const code = await askHidden('Yeni erişim kodu: ');
  if (code.trim().length < MIN_LENGTH) {
    console.error(`Kod en az ${MIN_LENGTH} karakter olmalıdır.`);
    process.exit(1);
  }
  if ((await askHidden('Yeni erişim kodu (tekrar): ')) !== code) {
    console.error('Kodlar aynı değil; değişiklik yapılmadı.');
    process.exit(1);
  }
  writeLock(code);
  say('Erişim kodu güncellendi.');
}
say('src/config/panel-lock.json değişti; commit edip siteyi yeniden yayınlayınız.');
