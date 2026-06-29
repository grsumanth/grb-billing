# GRB Billing — Manual Testing Checklist

Use this checklist to verify the frontend user interface and backend integration of the GRB Billing application. You can mark items as `[x]` as you test them.

---

## 🔐 1. Authentication Page (`index.html`)

### 🔹 Login Tab
- [ ] **Tab Switcher**: Click on **Login** and **Sign Up** tabs. Verify the forms toggle correctly.
- [ ] **Username Input (`#login-username`)**: Focus, type a valid username.
- [ ] **Username pre-fill & checkmark**: If a user just registered, verify the Username is automatically pre-filled, set as read-only, has a checkmark `✓` visible, and the PIN input is auto-focused.
- [ ] **Edit Username link**: If username is pre-filled, click "Change Username" and verify the field becomes editable.
- [ ] **Security PIN Input (`#login-pin`)**: Verify PIN masked by default.
- [ ] **Visibility Toggle (`👁️` / `🙈` button)**: Click to toggle PIN visibility.
- [ ] **Forgot PIN & Change PIN Links**: Click to verify helpful info alerts.
- [ ] **Enter Key Submission**: Focus inside PIN input and hit `Enter` key. Verify login starts.
- [ ] **Login Button (`#btn-login-submit`)**: 
  - Leave fields blank, click, and verify the validation message: *“Please fill in all fields.”*
  - Type invalid credentials, click, and verify the error message.
  - Type valid credentials, click, verify the success message appears, and you are redirected to `dashboard.html`.

### 🔹 Sign Up Tab
- [ ] **Full Name Input (`#signup-name`)**: Focus and type your name.
- [ ] **Username Input (`#signup-username`)**: Focus and type a unique username (lowercase, alphanumeric).
- [ ] **Security PIN Input (`#signup-pin`)**: Type a 4 or 6-digit numeric PIN.
- [ ] **Visibility Toggle (`👁️` / `🙈` button)**: Verify PIN visibility toggle works.
- [ ] **Create Account Button (`#btn-signup-submit`)**:
  - Leave fields blank, click, verify the validation error.
  - Type a PIN with invalid length (e.g. 3 or 5 digits), click, verify the validation error.
  - Type a valid new user payload, click, verify successful registration, and automatic tab switch to Login page with username pre-filled.

---

## 🧾 2. Main Dashboard: Billing Tab (`dashboard.html` → Billing)

### 🔹 Sidebar / Navigation Panel (Desktop) or Bottom Navigation (Mobile)
- [ ] **Nav Buttons**: Click each nav link (**Billing, Customers, Products, Gallery, Reports, Profile**). Verify pages switch instantly and the URL hash updates.
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
- [ ] **Print Bill Button (`#btn-print-bill` 🖨)**: Click to trigger printing layout.
- [ ] **Bill Size Presets**: Click **A4**, **A5**, and **Receipt** presets. Verify width (`#billW`) and height (`#billH`) inputs update to preset coordinates.

### 🔹 Today Summary Panel (Right/Sidebar or Mobile Grid)
- [ ] **Bills Today (`#sBills`)**: Verify count increases when a new bill is created.
- [ ] **Total Sales (`#sSales`)**: Verify total updates.
- [ ] **GST Collected (`#sGst`)**: Verify GST updates.
- [ ] **Recent Bills List (`#rBills`)**: Verify new bills display as line items immediately.

---

## 👤 3. Customers Page (`dashboard.html` → Customers)

- [ ] **Search Box (`#input-search-customers`)**: Type letters. Verify the customer list filters dynamically.
- [ ] **Add Customer Modal Button (`#btn-customer-add`)**: Click to open.
  - Enter Name, Phone, Address, Notes.
  - Click **Save**. Verify the new customer is added to the table.
  - Try registering a duplicate phone number; verify the validation error triggers.
- [ ] **Edit Customer Button (`bedit` ✏)**: Click on a customer row.
  - Change their details.
  - Click **Save**. Verify updates reflect in the table.
- [ ] **Delete Customer Button (`bdel` 🗑)**: Click, confirm deletion dialog. Verify row disappears from the table.

---

## 📦 4. Products Page (`dashboard.html` → Products)

- [ ] **Search Box (`#input-search-products`)**: Type letters. Verify products filter dynamically.
- [ ] **Add Product Modal Button (`#btn-product-add`)**: Click to open.
  - Enter Product Name, select Unit Type (**Piece**, **Box**, or **Pack**), enter Price.
  - Click **Save**. Verify new product is listed.
- [ ] **Edit Product Button (`bedit` ✏)**: Click on a row.
  - Modify product name or price.
  - Click **Save**. Verify changes display immediately.
- [ ] **Delete Product Button (`bdel` 🗑)**: Click, confirm deletion. Verify product row is removed.

---

## 🖼️ 5. Gallery Page (`dashboard.html` → Gallery)

- [ ] **Add Category Button (`#btn-gallery-add-category`)**: Click to create a new category.
- [ ] **Category Grid (`#galleryGrid`)**: Verify categories display cleanly.
- [ ] **Category Detail View**: Click a category card.
  - Verify it shows the detailed image grid (`#galleryViewGrid`).
  - Click **Back** (`#btn-gallery-back`) to return to main categories.
  - Try uploading new images to a category.

---

## ⚙️ 6. Profile Settings Page (`dashboard.html` → Profile)

- [ ] **Profile Picture Upload (`#profilePicInput`)**: Click profile picture frame, choose an image file. Verify image updates locally and header badge updates.
- [ ] **Full Name Input (`#profName`)**: Change name, click **Save Profile**. Verify name changes in the Top Bar badge.
- [ ] **Phone Number Input (`#profPhone`)**: Change phone, click **Save Profile** and verify it updates.
- [ ] **Read-only Fields**: Verify **Username** and **Email** are read-only / disabled.
- [ ] **Change PIN (`#profCurPwd` & `#profNewPwd`)**: Enter current PIN and a new 4 or 6-digit PIN. Click **Change PIN** and verify success toast.

---

## 📊 7. Reports & Analytics Page (`dashboard.html` → Reports)

### 🔹 Analytics Cards
- [ ] **Sales Cards**: Verify counts for Daily Sales (`#rDS`), Total Bills (`#rTB`), Collected Paid (`#rTR` - sum of paid amounts), GST (`#rGC`), and Outstanding (`#rOB`) load correctly.

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
1. Register a new account under **Sign Up** using Username and 4/6-digit security PIN.
2. Confirm you are redirected to **Login** tab with your Username pre-filled and checkmarked. Enter security PIN to login.
3. Go to **Products** and add 2-3 items.
4. Go to **Customers** and add a test customer.
5. Go to **Billing**, create a bill using the new customer & products, toggle GST on, and click **Print Bill**.
6. Go to **Reports** and verify the bill history and analytics cards show your new transaction.

