/**
 * Converts a number into Indian English words (Rupees and Paise).
 * e.g. 10250.50 -> "Ten Thousand Two Hundred Fifty Rupees and Fifty Paise Only"
 */

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
];

const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function convertChunk(n: number): string {
  let str = '';
  if (n > 99) {
    str += ONES[Math.floor(n / 100)] + ' Hundred ';
    n %= 100;
  }
  if (n > 19) {
    str += TENS[Math.floor(n / 10)] + ' ';
    n %= 10;
  }
  if (n > 0) {
    str += ONES[n] + ' ';
  }
  return str.trim();
}

export function numberToWords(amount: number): string {
  if (amount === 0) return 'Zero Rupees Only';

  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);

  const rupees = Math.floor(absAmount);
  const paise = Math.round((absAmount - rupees) * 100);

  let word = '';
  let rem = rupees;

  if (Math.floor(rem / 10000000) > 0) {
    word += convertChunk(Math.floor(rem / 10000000)) + ' Crore ';
    rem %= 10000000;
  }
  if (Math.floor(rem / 100000) > 0) {
    word += convertChunk(Math.floor(rem / 100000)) + ' Lakh ';
    rem %= 100000;
  }
  if (Math.floor(rem / 1000) > 0) {
    word += convertChunk(Math.floor(rem / 1000)) + ' Thousand ';
    rem %= 1000;
  }
  if (rem > 0) {
    word += convertChunk(rem) + ' ';
  }

  word = word.trim() + ' Rupees';

  if (paise > 0) {
    word += ' and ' + convertChunk(paise) + ' Paise';
  }

  word += ' Only';

  return (isNegative ? 'Negative ' : '') + word.replace(/\s+/g, ' ');
}
