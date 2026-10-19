/**
 * אלגוריתם ההתחשבנות – חלוקה שווה בשווה, במספר העברות קטן.
 *
 * הכל באגורות (מספרים שלמים), כדי שלא יהיו טעויות עיגול:
 * 1. סך ההוצאות מחולק שווה בין כל המשתתפים. אם הסכום לא מתחלק בדיוק,
 *    האגורות שנשארו מתחלקות אחת-אחת בין המשתתפים הראשונים ברשימה.
 * 2. יתרה = כמה שילם פחות החלק שלו. חיובית = מגיע לו כסף. שלילית = הוא חייב.
 * 3. בכל שלב, החייב הגדול ביותר משלם לנושה הגדול ביותר, עד שכולם מאוזנים.
 *    כך מספר ההעברות הוא לכל היותר (מספר המשתתפים - 1).
 */

export interface SettlementInput {
  userId: number;
  paidCents: number;
}

export interface SettlementBalance {
  userId: number;
  paidCents: number;
  shareCents: number;
  balanceCents: number;
}

export interface SettlementTransferResult {
  fromUserId: number;
  toUserId: number;
  amountCents: number;
}

export const calculateSettlement = (participants: SettlementInput[]) => {
  const n = participants.length;
  const totalCents = participants.reduce((s, p) => s + p.paidCents, 0);
  if (n === 0) return { totalCents, balances: [] as SettlementBalance[], transfers: [] as SettlementTransferResult[] };

  const base = Math.floor(totalCents / n);
  const remainder = totalCents - base * n;

  const balances: SettlementBalance[] = participants.map((p, i) => {
    const shareCents = base + (i < remainder ? 1 : 0);
    return { userId: p.userId, paidCents: p.paidCents, shareCents, balanceCents: p.paidCents - shareCents };
  });

  const creditors = balances.filter((b) => b.balanceCents > 0).map((b) => ({ userId: b.userId, left: b.balanceCents }));
  const debtors = balances.filter((b) => b.balanceCents < 0).map((b) => ({ userId: b.userId, left: -b.balanceCents }));

  const transfers: SettlementTransferResult[] = [];
  while (creditors.length > 0 && debtors.length > 0) {
    creditors.sort((a, b) => b.left - a.left);
    debtors.sort((a, b) => b.left - a.left);
    const creditor = creditors[0]!;
    const debtor = debtors[0]!;
    const amountCents = Math.min(creditor.left, debtor.left);

    transfers.push({ fromUserId: debtor.userId, toUserId: creditor.userId, amountCents });
    creditor.left -= amountCents;
    debtor.left -= amountCents;
    if (creditor.left === 0) creditors.shift();
    if (debtor.left === 0) debtors.shift();
  }

  return { totalCents, balances, transfers };
};
