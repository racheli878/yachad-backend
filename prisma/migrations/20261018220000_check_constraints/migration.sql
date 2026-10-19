-- אילוצי תקינות ברמת מסד הנתונים (הגנה נוספת מעבר לוולידציה בשרת)

-- הזמנה חייבת לכלול מייל או טלפון
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_contact_required"
  CHECK ("email" IS NOT NULL OR "phone" IS NOT NULL);

-- סכום הוצאה חיובי
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_amount_positive"
  CHECK ("amount" > 0);

-- תקציב לא שלילי
ALTER TABLE "Event" ADD CONSTRAINT "Event_budget_non_negative"
  CHECK ("budget" IS NULL OR "budget" >= 0);

-- העברה בהתחשבנות: סכום חיובי ובין שני אנשים שונים
ALTER TABLE "SettlementTransfer" ADD CONSTRAINT "SettlementTransfer_amount_positive"
  CHECK ("amount" > 0);
ALTER TABLE "SettlementTransfer" ADD CONSTRAINT "SettlementTransfer_different_users"
  CHECK ("fromUserId" <> "toUserId");
