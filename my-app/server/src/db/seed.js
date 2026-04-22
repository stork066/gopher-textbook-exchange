require('dotenv').config()
const { PutCommand } = require('@aws-sdk/lib-dynamodb')
const { v4: uuidv4 } = require('uuid')
const { docClient } = require('./dynamodb')

const departments = [
  { department_code: 'ACCT', department_name: 'Accounting' },
  { department_code: 'BIOL', department_name: 'Biology' },
  { department_code: 'CHEM', department_name: 'Chemistry' },
  { department_code: 'COMM', department_name: 'Communication Studies' },
  { department_code: 'CSCI', department_name: 'Computer Science & Engineering' },
  { department_code: 'ECON', department_name: 'Economics' },
  { department_code: 'ENGL', department_name: 'English' },
  { department_code: 'FINA', department_name: 'Finance' },
  { department_code: 'HIST', department_name: 'History' },
  { department_code: 'IDSC', department_name: 'Information & Decision Sciences' },
  { department_code: 'MATH', department_name: 'Mathematics' },
  { department_code: 'MGMT', department_name: 'Management' },
  { department_code: 'MKTG', department_name: 'Marketing' },
  { department_code: 'MSBA', department_name: 'Business Analytics' },
  { department_code: 'PHYS', department_name: 'Physics' },
  { department_code: 'POLS', department_name: 'Political Science' },
  { department_code: 'PSY', department_name: 'Psychology' },
  { department_code: 'SCO', department_name: 'Supply Chain & Operations' },
  { department_code: 'SOC', department_name: 'Sociology' },
  { department_code: 'STAT', department_name: 'Statistics' },
]

const now = new Date()
const ts = (offsetDays = 0) => {
  const d = new Date(now)
  d.setDate(d.getDate() - offsetDays)
  return d.toISOString()
}

// Generate listing IDs up front so offers can reference them
const listingIds = Array.from({ length: 5 }, () => uuidv4())

const listings = [
  {
    listing_id: listingIds[0],
    course_department: 'CSCI',
    course_number: '1133',
    textbook_title: 'Introduction to Computing Systems: From Bits & Gates to C/C++ & Beyond',
    author: 'Yale N. Patt, Sanjay J. Patel',
    edition: '3rd',
    condition: 'Good',
    price: 55,
    seller_name: 'Alex R.',
    seller_contact: 'alexr@umn.edu',
    description: 'Some highlighting in chapters 1–4, otherwise clean. All pages intact.',
    image_url: 'https://placehold.co/400x600?text=Textbook',
    status: 'Available',
    created_at: ts(2),
    updated_at: ts(2),
  },
  {
    listing_id: listingIds[1],
    course_department: 'MATH',
    course_number: '1271',
    textbook_title: 'Calculus: Early Transcendentals',
    author: 'James Stewart',
    edition: '8th',
    condition: 'Like New',
    price: 80,
    seller_name: 'Jordan M.',
    seller_contact: 'jmiller@umn.edu',
    description: 'Barely used — only opened for a few weeks before switching sections. No writing inside.',
    image_url: 'https://placehold.co/400x600?text=Textbook',
    status: 'Available',
    created_at: ts(5),
    updated_at: ts(5),
  },
  {
    listing_id: listingIds[2],
    course_department: 'ACCT',
    course_number: '2050',
    textbook_title: 'Accounting: Tools for Business Decision Making',
    author: 'Paul D. Kimmel, Jerry J. Weygandt, Donald E. Kieso',
    edition: '7th',
    condition: 'Fair',
    price: 40,
    seller_name: 'Sam T.',
    seller_contact: 'samt@umn.edu',
    description: 'Heavy highlighting and some notes throughout, but all content is legible. Good for following along in lecture.',
    image_url: 'https://placehold.co/400x600?text=Textbook',
    status: 'Available',
    created_at: ts(10),
    updated_at: ts(10),
  },
  {
    listing_id: listingIds[3],
    course_department: 'ECON',
    course_number: '1101',
    textbook_title: 'Principles of Economics',
    author: 'N. Gregory Mankiw',
    edition: '9th',
    condition: 'Good',
    price: 60,
    seller_name: 'Casey L.',
    seller_contact: 'caseyl@umn.edu',
    description: 'Minor wear on cover. A few pencil marks that have been mostly erased.',
    image_url: 'https://placehold.co/400x600?text=Textbook',
    status: 'Available',
    created_at: ts(1),
    updated_at: ts(1),
  },
  {
    listing_id: listingIds[4],
    course_department: 'PSY',
    course_number: '1001',
    textbook_title: 'Psychology: From Inquiry to Understanding',
    author: 'Scott O. Lilienfeld, Steven Jay Lynn, Laura L. Namy',
    edition: '4th',
    condition: 'Good',
    price: 45,
    seller_name: 'Morgan K.',
    seller_contact: 'morgank@umn.edu',
    description: 'Light highlighting in first half of book. No missing pages.',
    image_url: 'https://placehold.co/400x600?text=Textbook',
    status: 'Available',
    created_at: ts(7),
    updated_at: ts(7),
  },
]

const offers = [
  {
    offer_id: uuidv4(),
    listing_id: listingIds[0],
    buyer_name: 'Taylor B.',
    buyer_contact: 'taylorb@umn.edu',
    offer_amount: 48,
    message: 'Hey! Would you take $48? I can meet on campus this week.',
    status: 'Pending',
    created_at: ts(1),
  },
  {
    offer_id: uuidv4(),
    listing_id: listingIds[2],
    buyer_name: 'Riley S.',
    buyer_contact: 'rileys@umn.edu',
    offer_amount: 35,
    message: 'Is $35 OK? I can pick up any day after 2pm near Coffman.',
    status: 'Pending',
    created_at: ts(0),
  },
]

async function seed() {
  console.log('Seeding Departments...')
  for (const dept of departments) {
    await docClient.send(new PutCommand({ TableName: 'Departments', Item: dept }))
  }
  console.log(`  [ok] ${departments.length} departments inserted`)

  console.log('Seeding Listings...')
  for (const listing of listings) {
    await docClient.send(new PutCommand({ TableName: 'Listings', Item: listing }))
  }
  console.log(`  [ok] ${listings.length} listings inserted`)

  console.log('Seeding Offers...')
  for (const offer of offers) {
    await docClient.send(new PutCommand({ TableName: 'Offers', Item: offer }))
  }
  console.log(`  [ok] ${offers.length} offers inserted`)
}

seed()
  .then(() => {
    console.log('Seeding complete.')
    process.exit(0)
  })
  .catch((err) => {
    console.error('Seeding failed:', err.message)
    process.exit(1)
  })
