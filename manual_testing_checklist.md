# GRB Billing — Manual Testing Checklist

Use this checklist to verify the frontend user interface and backend integration of the GRB Billing application. You can mark items as `[x]` as you test them.

---

## 🔐 1. Authentication Page (`index.html`)

### 🔹 Login Tab
- [ ] **Tab Switcher**: Click on **Login** and **Sign Up** tabs. Verify the forms toggle correctly.
- [ ] **Email Input (`#login-email`)**: Focus, type a valid/invalid email.
- [ ] **Password Input (`#login-pass`)**: Type characters and verify they are masked.
- [ ] **Visibility Toggle (`👁️` / `🙈` button)**: Click to toggle password masking.
- [ ] **Forgot Password Link (`#link-forgot-password`)**: Click and verify it redirects to `forgot-password.html`.
- [ ] **Enter Key Submission**: Focus inside password and hit `Enter` key. Verify login starts.
- [ ] **Login Button (`#btn-login-submit`)**: 
  - Leave fields blank, click, and verify the validation message: *“Please fill in all fields.”*
  - Type invalid credentials, click, and verify the error message matches backend API feedback.
  - Type valid credentials, click, verify the success message appears, and you are redirected to `dashboard.html`.

### 🔹 Sign Up Tab
- [ ] **Full Name Input (`#signup-name`)**: Focus and type your name.
- [ ] **Email Input (`#signup-email`)**: Focus and type a unique email.
- [ ] **Password Input (`#signup-pass`)**: Type a password.
- [ ] **Visibility Toggle (`👁️` / `🙈` button)**: Verify password visibility toggle works.
- [ ] **Role Dropdown (`#signup-role`)**: Click and verify options **User** and **Admin** are selectable.
- [ ] **Create Account Button (`#btn-signup-submit`)**:
  - Leave fields blank, click, verify the validation error.
  - Type a password shorter than 6 characters, click, verify the validation error: *“Password must be at least 6 characters.”*
  - Type a valid new user payload, click, verify successful registration, and automatic redirection to `dashboard.html`.

---

## 🔑 2. Password Recovery (`forgot-password.html`)

### 🔹 Step 1: Request OTP
- [ ] **Email Input (`#fp-email`)**: Focus and type email.
- [ ] **Back to Login (`#link-back-to-login`)**: Verify link redirects back to `index.html`.
- [ ] **Send OTP Button (`#btn-send-otp`)**:
  - Leave email blank, click, and verify error message.
  - Enter a nonexistent email, click, verify `404` error message.
  - Enter a valid user email, click, verify it moves to **Step 2**.

### 🔹 Step 2: OTP Verification
- [ ] **OTP Input (`#fp-otp`)**: Verify it accepts exactly 6 numeric characters.
- [ ] **Enter different email Link (`#link-change-email`)**: Click to go back to Step 1.
- [ ] **Verify OTP Button (`#btn-verify-otp`)**:
  - Enter a wrong/random OTP, click, and verify validation error.
  - Enter the correct OTP (sent to your email console/inbox), click, and verify it moves to **Step 3**.

### 🔹 Step 3: Password Reset
- [ ] **New Password Input (`#fp-newpass`)**: Type new password (with visibility toggles).
- [ ] **Confirm Password Input (`#fp-confirmpass`)**: Type password confirmation.
- [ ] **Reset Password Button (`#btn-reset-password-submit`)**:
  - Enter mismatched passwords, click, verify mismatch error.
  - Enter a valid matching password, click, verify it transitions to **Step 4: Success**.

### 🔹 Step 4: Success Screen
- [ ] **Go to Login Button (`#btn-go-to-login`)**: Click and verify it redirects to `index.html`.
- [ ] **New Password Test**: Login with the newly set password to confirm it works.

---

## 🧾 3. Main Dashboard: Billing Tab (`dashboard.html` → Billing)

### 🔹 Sidebar / Navigation Panel (Desktop) or Bottom Navigation (Mobile)
- [ ] **Nav Buttons**: Click each nav link (**Billing, Customers, Products, Gallery, Profile, Reports**). Verify pages switch instantly and the URL hash updates.
- [ ] **Profile Badge (Top Right)**: Verify it displays your initials (`#topbarInitial`) and name (`#uname`).
- [ ] **Logout Button (`#btn-sidebar-logout`)**: Click and verify you are logged out and redirected to the login screen.

### 🔹 New Bill Form
- [ ] **Customer Name Autocomplete Input (`#bCust`)**:
  - Type letters (e.g., "Ravi") and verify the dropdown suggestions box (`#sugg`) appears with matches.
  - Click a suggestion and verify the field populates.
- [ ] **Pick Customer Button (`#btn-pick-customer` 📋)**: Click to open a quick modal selection. Select a customer to fill the input automatically.
- [ ] **Product Dropdown (`#pSel`)**: Click and select a product.
- [ ] **Qty Input (`#bQty`)**: Enter a positive integer (e.g., `2`).
- [ ] **Unit Type Input (`#bType`)**: Verify it automatically populates (e.g., `Piece`, `Box`, `Pack`) and is **read-only** (cannot be typed in).
- [ ] **Price Input (`#bPrice`)**: Verify the default product price is loaded. Modify it to a custom price.
- [ ] **Add Item to Bill Button (`#btn-add-item`)**: Click to add the item. Verify it appears in the table.
- [ ] **Items Table (`#bBody` & `#bEmpty`)**:
  - Verify line items show index, name, unit type, quantity, rate, and line total.
  - **Delete Item Button (`bdel` 🗑)**: Click to remove a line item from the table. Verify totals recalculate.
  - Verify `#bEmpty` message appears if no items are in the table.

### 🔹 GST & Carried Balances
- [ ] **Apply GST Toggle Switch (`#gstChk`)**: Toggle ON/OFF.
- [ ] **GST Percentage Input (`#gstPct`)**: Shown when toggle is ON. Change value (e.g., `18%` or `5%`) and check if Grand Total updates.
- [ ] **Include Previous Balance Toggle Switch (`#includePrevBalChk`)**: Toggle ON/OFF.
- [ ] **Previous Balance Input (`#prevBalInput`)**: Verify it auto-fetches the outstanding balance if the selected customer has one. Toggle ON and verify Grand Total updates.

### 🔹 Bill Totals & Actions
- [ ] **Subtotal (`#sub`)**: Verify it equals the sum of line item totals.
- [ ] **Grand Total (`#gtotal`)**: Verify the calculation: `(Subtotal + GST Amount) + Previous Balance`.
- [ ] **Clear Bill Button (`#btn-clear-bill` 🗑)**: Click and verify all fields, table rows, and toggles reset.
- [ ] **Email Bill Button (`#btn-email-bill` 📧)**: Click to send the bill as a PDF attachment to the customer's email. Verify success toast message.
- [ ] **Print Bill Button (`#btn-print-bill` 🖨)**: Click to trigger printing layout.
- [ ] **Bill Size Presets**: Click **A4**, **A5**, and **Receipt** presets. Verify width (`#billW`) and height (`#billH`) inputs update to preset coordinates.

### 🔹 Today Summary Panel (Right/Sidebar or Mobile Grid)
- [ ] **Bills Today (`#sBills`)**: Verify count increases when a new bill is created.
- [ ] **Total Sales (`#sSales`)**: Verify total updates.
- [ ] **GST Collected (`#sGst`)**: Verify GST updates.
- [ ] **Recent Bills List (`#rBills`)**: Verify new bills display as line items immediately.

---

## 👤 4. Customers Page (`dashboard.html` → Customers)

- [ ] **Search Box (`#input-search-customers`)**: Type letters. Verify the customer list filters dynamically.
- [ ] **Add Customer Modal Button (`#btn-customer-add`)**: Click to open.
  - Enter Name, Phone, Email, Address, Notes.
  - Click **Save**. Verify the new customer is added to the table.
  - Try registering a duplicate phone number; verify the validation error triggers.
- [ ] **Edit Customer Button (`bedit` ✏)**: Click on a customer row.
  - Change their details.
  - Click **Save**. Verify updates reflect in the table.
- [ ] **Delete Customer Button (`bdel` 🗑)**: Click, confirm deletion dialog. Verify row disappears from the table.

---

## 📦 5. Products Page (`dashboard.html` → Products)

- [ ] **Search Box (`#input-search-products`)**: Type letters. Verify products filter dynamically.
- [ ] **Add Product Modal Button (`#btn-product-add`)**: Click to open.
  - Enter Product Name, select Unit Type (**Piece**, **Box**, or **Pack**), enter Price.
  - Click **Save**. Verify new product is listed.
- [ ] **Edit Product Button (`bedit` ✏)**: Click on a row.
  - Modify product name or price.
  - Click **Save**. Verify changes display immediately.
- [ ] **Delete Product Button (`bdel` 🗑)**: Click, confirm deletion. Verify product row is removed.

---

## 🖼️ 6. Gallery Page (`dashboard.html` → Gallery)

- [ ] **Add Category Button (`#btn-gallery-add-category`)**: Click to create a new category.
- [ ] **Category Grid (`#galleryGrid`)**: Verify categories display cleanly.
- [ ] **Category Detail View**: Click a category card.
  - Verify it shows the detailed image grid (`#galleryViewGrid`).
  - Click **Back** (`#btn-gallery-back`) to return to main categories.
  - Try uploading new images to a category.

---

## ⚙️ 7. Profile Settings Page (`dashboard.html` → Profile)

- [ ] **Profile Picture Upload (`#profilePicInput`)**: Click the pencil icon (`✏`), choose an image file. Verify image updates locally and header badge updates.
- [ ] **Full Name Input (`#profileName`)**: Change name, click **Save Profile**. Verify name changes in the Top Bar badge.
- [ ] **Phone Number Input (`#profilePhone`)**:
  - Enter a valid 10-digit number.
  - Try typing letters; verify only numbers are accepted.
  - Click **Save Profile** and check if updates persist.
- [ ] **Read-only Fields**: Verify **Email Address** and **Role** inputs are disabled/readonly.

---

## 📊 8. Reports & Analytics Page (`dashboard.html` → Reports)

### 🔹 Analytics Cards
- [ ] **Sales Cards**: Verify counts for Daily Sales (`#rDS`), Total Bills (`#rTB`), Revenue (`#rTR`), GST (`#rGC`), and Outstanding (`#rOB`) load correctly.

### 🔹 Bill History Table
- [ ] **Bill Details**: Verify all previous bills show correct details.
- [ ] **Download PDF / View PDF Button**: Click and verify a valid invoice PDF opens in a new tab.
- [ ] **Delete Bill Button (`#bdelbill`)**: Click a bill, confirm deletion. Verify statistics cards and remaining balance sums recalculate immediately.

### 🔹 Outstanding Balance Report Card
- [ ] **Search Filter (`#obSrch`)**: Type names to filter outstanding bills.
- [ ] **Total Remaining Balance Sum (`#obTotalSum`)**: Verify it matches the sum of all remaining unpaid balances.
- [ ] **Record Payment Button**: Click on an outstanding bill.
  - Enter the amount received.
  - Enter payment note (e.g. "Paid partially via UPI").
  - Click **Submit**. Verify remaining balance updates, and if fully paid, check if the bill moves to "Paid" status.

---

### 🚀 Recommended Testing Flow:
1. Register a new account under **Sign Up**.
2. Go to **Products** and add 2-3 items.
3. Go to **Customers** and add a test customer.
4. Go to **Billing**, create a bill using the new customer & products, toggle GST on, and click **Print Bill**.
5. Go to **Reports** and verify the bill history and analytics cards show your new transaction.
