# Pharmacy Sales Ledger

A lightweight, fast, and mobile-friendly web application for pharmacy shopkeepers to record daily medicine sales and generate reports.

## Features

- **Dashboard** — Today's sales overview with Cash / UPI / Credit breakdowns
- **Quick Sale Entry** — Large input fields for fast counter-side data entry
- **Sales List** — View, edit, and delete today's sales with search
- **Reports** — Filter by Today / Yesterday / This Month / Custom range, with totals
- **Export** — Download reports as Excel (.xlsx) or PDF
- **Auto Invoice Numbers** — INV-0001, INV-0002, … auto-increment
- **Mobile First** — Works great on phones at the pharmacy counter

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite + TypeScript |
| Styling | Tailwind CSS |
| Database | Supabase (PostgreSQL) |
| Excel Export | SheetJS (xlsx) |
| PDF Export | jsPDF + jspdf-autotable |
| Icons | Lucide React |
| Routing | React Router v6 |

## Supabase Setup

### 1. Create a Supabase Project

Go to [supabase.com](https://supabase.com) and create a new project.

### 2. Run the Schema

In Supabase → SQL Editor, paste and run the contents of `supabase/schema.sql`.

### 3. Configure Environment Variables

```bash
cp .env.example .env
```

Fill in from **Supabase → Settings → API**:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Run

```bash
npm install
npm run dev
```

## Build for Production

```bash
npm run build
```

## Database Schema

```
sales
├── id              uuid (primary key)
├── sale_date       date
├── invoice_number  text (unique, INV-0001, INV-0002...)
├── medicine_name   text
├── quantity        numeric
├── mrp             numeric
├── selling_rate    numeric
├── total_amount    numeric
├── payment_mode    text (Cash | UPI | Credit)
├── customer_name   text (optional)
├── remarks         text (optional)
└── created_at      timestamptz
```

## Usage Guide

### Recording a Sale
1. Tap **Quick Sale** in the sidebar
2. Enter medicine name, quantity, MRP, and selling rate
3. Total amount auto-calculates
4. Select payment mode (Cash / UPI / Credit)
5. Tap **Save Sale** or **Save & New Entry**

### Reports & Export
1. Go to **Reports**
2. Choose Today / Yesterday / This Month / Custom
3. Download as Excel or PDF
