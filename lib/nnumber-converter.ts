/**
 * N-Number to ICAO Hex Converter for US Aircraft
 * 
 * Faithful port of https://github.com/guillaumemichel/icao-nnumber_converter
 * Converts US tail numbers (N-numbers) to ICAO 24-bit addresses and vice versa.
 * 
 * US ICAO addresses range from A00001 (N1) to ADF7C7 (N99999)
 */

const ICAO_SIZE = 6;
const NNUMBER_MAX_SIZE = 6;

// Alphabet without I and O to avoid confusion with 1 and 0
const CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITSET = "0123456789";
const HEXSET = "0123456789ABCDEF";
const ALLCHARS = CHARSET + DIGITSET;

// Pre-calculated bucket sizes for the sequential mapping
const SUFFIX_SIZE = 1 + CHARSET.length * (1 + CHARSET.length); // 601
const BUCKET4_SIZE = 1 + CHARSET.length + DIGITSET.length; // 35
const BUCKET3_SIZE = DIGITSET.length * BUCKET4_SIZE + SUFFIX_SIZE; // 951
const BUCKET2_SIZE = DIGITSET.length * BUCKET3_SIZE + SUFFIX_SIZE; // 10111
const BUCKET1_SIZE = DIGITSET.length * BUCKET2_SIZE + SUFFIX_SIZE; // 101711

/**
 * Get alphabetical suffix from offset
 * 0 -> ''
 * 1 -> 'A'
 * 2 -> 'AA'
 * 3 -> 'AB'
 * ...
 * 600 -> 'ZZ'
 */
function getSuffix(offset: number): string {
  if (offset === 0) return '';
  
  const char0 = CHARSET[Math.floor((offset - 1) / (CHARSET.length + 1))];
  const rem = (offset - 1) % (CHARSET.length + 1);
  
  if (rem === 0) return char0;
  return char0 + CHARSET[rem - 1];
}

/**
 * Get offset from alphabetical suffix
 * '' -> 0
 * 'A' -> 1
 * 'AA' -> 2
 * 'AB' -> 3
 * ...
 * 'ZZ' -> 600
 */
function suffixOffset(s: string): number | null {
  if (s.length === 0) return 0;
  
  // Validate suffix
  if (s.length > 2) return null;
  for (const c of s) {
    if (!CHARSET.includes(c)) return null;
  }
  
  let count = (CHARSET.length + 1) * CHARSET.indexOf(s[0]) + 1;
  if (s.length === 2) {
    count += CHARSET.indexOf(s[1]) + 1;
  }
  return count;
}

/**
 * Create ICAO hex address from prefix and number
 */
function createIcao(prefix: string, i: number): string | null {
  const suffix = i.toString(16);
  const totalLen = prefix.length + suffix.length;
  
  if (totalLen > ICAO_SIZE) return null;
  
  return prefix + '0'.repeat(ICAO_SIZE - totalLen) + suffix;
}

/**
 * Convert US N-Number to ICAO hex address
 * 
 * @param nnumber - US tail number (e.g., "N12345", "N842QS")
 * @returns ICAO hex address (e.g., "a061d9", "ab88b6") or null if invalid
 * 
 * @example
 * nNumberToIcao("N1") // "a00001"
 * nNumberToIcao("N842QS") // "ab88b6"
 * nNumberToIcao("N12345") // "a061d9"
 */
export function nNumberToIcao(nnumber: string): string | null {
  // Normalize input
  nnumber = nnumber.toUpperCase().trim();
  
  // Validate format: must start with N and be 2-6 chars
  if (nnumber.length < 2 || nnumber.length > NNUMBER_MAX_SIZE) return null;
  if (nnumber[0] !== 'N') return null;
  
  // Validate all characters after 'N'
  for (let i = 1; i < nnumber.length; i++) {
    if (!ALLCHARS.includes(nnumber[i])) return null;
  }
  
  // Validate format: letters can only appear in the last 2 positions (suffix)
  // Check positions 1 through length-3 (the "core" before suffix)
  if (nnumber.length > 3) {
    for (let i = 1; i <= nnumber.length - 3; i++) {
      if (CHARSET.includes(nnumber[i])) return null;
    }
  }
  
  const prefix = 'a';
  let count = 0;
  
  if (nnumber.length > 1) {
    const tail = nnumber.substring(1);
    count += 1;
    
    for (let i = 0; i < tail.length; i++) {
      if (i === 4) { // Position 4 in tail (5th char after N, last possible)
        // Last possible character - must be alphanumeric
        count += ALLCHARS.indexOf(tail[i]) + 1;
      } else if (CHARSET.includes(tail[i])) {
        // First alphabetical char found - rest is suffix
        const offset = suffixOffset(tail.substring(i));
        if (offset === null) return null;
        count += offset;
        break; // Suffix found, done
      } else {
        // Numeric digit at this position
        const digit = parseInt(tail[i], 10);
        if (i === 0) {
          count += (digit - 1) * BUCKET1_SIZE;
        } else if (i === 1) {
          count += digit * BUCKET2_SIZE + SUFFIX_SIZE;
        } else if (i === 2) {
          count += digit * BUCKET3_SIZE + SUFFIX_SIZE;
        } else if (i === 3) {
          count += digit * BUCKET4_SIZE + SUFFIX_SIZE;
        }
      }
    }
  }
  
  return createIcao(prefix, count);
}

/**
 * Convert ICAO hex address to US N-Number
 * 
 * @param icao - ICAO hex address (e.g., "a00001", "AB88B6")
 * @returns N-Number (e.g., "N1", "N842QS") or null if invalid
 * 
 * @example
 * icaoToNNumber("a00001") // "N1"
 * icaoToNNumber("AB88B6") // "N842QS"
 * icaoToNNumber("a061d9") // "N12345"
 */
export function icaoToNNumber(icao: string): string | null {
  // Normalize input
  icao = icao.toUpperCase().trim();
  
  // Validate format
  if (icao.length !== ICAO_SIZE) return null;
  if (icao[0] !== 'A') return null;
  
  // Validate hex characters
  for (const c of icao) {
    if (!HEXSET.includes(c)) return null;
  }
  
  let output = 'N';
  
  let i = parseInt(icao.substring(1), 16) - 1;
  if (i < 0) return output; // Just "N"
  
  // Digit 1
  const dig1 = Math.floor(i / BUCKET1_SIZE) + 1;
  let rem1 = i % BUCKET1_SIZE;
  output += dig1.toString();
  
  if (rem1 < SUFFIX_SIZE) {
    return output + getSuffix(rem1);
  }
  
  // Digit 2
  rem1 -= SUFFIX_SIZE;
  const dig2 = Math.floor(rem1 / BUCKET2_SIZE);
  let rem2 = rem1 % BUCKET2_SIZE;
  output += dig2.toString();
  
  if (rem2 < SUFFIX_SIZE) {
    return output + getSuffix(rem2);
  }
  
  // Digit 3
  rem2 -= SUFFIX_SIZE;
  const dig3 = Math.floor(rem2 / BUCKET3_SIZE);
  let rem3 = rem2 % BUCKET3_SIZE;
  output += dig3.toString();
  
  if (rem3 < SUFFIX_SIZE) {
    return output + getSuffix(rem3);
  }
  
  // Digit 4
  rem3 -= SUFFIX_SIZE;
  const dig4 = Math.floor(rem3 / BUCKET4_SIZE);
  const rem4 = rem3 % BUCKET4_SIZE;
  output += dig4.toString();
  
  if (rem4 === 0) {
    return output;
  }
  
  // Last character
  return output + ALLCHARS[rem4 - 1];
}

/**
 * Validate if a string is a valid US N-Number format
 */
export function isValidNNumber(nnumber: string): boolean {
  return nNumberToIcao(nnumber) !== null;
}

/**
 * Validate if a string is a valid US ICAO hex address
 */
export function isValidUSIcao(icao: string): boolean {
  icao = icao.toUpperCase().trim();
  if (icao.length !== ICAO_SIZE) return false;
  if (icao[0] !== 'A') return false;
  for (const c of icao) {
    if (!HEXSET.includes(c)) return false;
  }
  return true;
}
