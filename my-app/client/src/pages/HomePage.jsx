import { Link } from 'react-router-dom'
import './HomePage.css'

const steps = [
  {
    number: '1',
    title: 'Browse by department',
    description: 'Filter by your course department and number to find exactly what you need.',
  },
  {
    number: '2',
    title: 'Find the right price',
    description: 'Compare listings from fellow students and pick the best deal for your budget.',
  },
  {
    number: '3',
    title: 'Contact the seller',
    description: 'Reach out directly — no middleman, no fees, just a simple handoff on campus.',
  },
]

export default function HomePage() {
  return (
    <div className="home">
      <section className="hero">
        <div className="hero-content">
          <h1 className="hero-title">GopherBooks</h1>
          <p className="hero-sub">Buy and sell textbooks with fellow UMN students</p>
          <p className="hero-tagline">
            A structured marketplace — no more digging through cluttered Facebook groups.
          </p>
          <div className="hero-actions">
            <Link to="/listings" className="btn-primary">Browse Listings</Link>
            <Link to="/post" className="btn-outline">Post a Listing</Link>
          </div>
        </div>
      </section>

      <section className="how-it-works">
        <h2 className="section-title">How It Works</h2>
        <div className="steps">
          {steps.map((step) => (
            <div key={step.number} className="step-card">
              <div className="step-number">{step.number}</div>
              <h3 className="step-title">{step.title}</h3>
              <p className="step-desc">{step.description}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
