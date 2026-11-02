import { Clock3, Mail, MapPin, Phone } from 'lucide-react'
import { useState } from 'react'
import Header from '../components/Header'
import Footer from '../components/Footer'
import './story.css'
import { LogoLoader, ScrollReveal } from '../components/PublicEnhancements'
import usePublicLoader from '../components/usePublicLoader'

function Contact() {
  const [submitted, setSubmitted] = useState(false)
  const loading = usePublicLoader()

  if (loading) return <div className="landing-page"><Header /><LogoLoader label="Opening our contact desk..." /></div>

  function submit(event) {
    event.preventDefault()
    setSubmitted(true)
    event.currentTarget.reset()
  }

  return (
    <div className="landing-page">
      <Header />
      <ScrollReveal><main className="contact-page">
        <section className="contact-hero">
          <p className="menu-kicker">GET IN TOUCH / MAISON BISTRO</p>
          <h1>Let’s talk over<br /><em>something delicious.</em></h1>
          <p>Have a question, planning a celebration, or just want to say hello? We would love to hear from you.</p>
        </section>
        <section className="contact-layout">
          <div className="contact-details">
            <div className="contact-detail"><span><MapPin size={18} /></span><div><h2>Visit us</h2><p>Maison Bistro<br />12 Bistro Lane, Dhaka<br />Bangladesh</p></div></div>
            <div className="contact-detail"><span><Phone size={18} /></span><div><h2>Call us</h2><p>+880 1700 000 000<br />Every day, 10am–11pm</p></div></div>
            <div className="contact-detail"><span><Mail size={18} /></span><div><h2>Email us</h2><p>hello@maisonbistro.com<br />We reply within one business day.</p></div></div>
            <div className="contact-detail"><span><Clock3 size={18} /></span><div><h2>Opening hours</h2><p>Saturday–Thursday: 10am–11pm<br />Friday: 2pm–11pm</p></div></div>
          </div>
          <form className="contact-form" onSubmit={submit}>
            <p className="menu-kicker">SEND A MESSAGE</p>
            <h2>How can we help?</h2>
            <div className="contact-form-grid"><label>Your name<input required name="name" placeholder="Your full name" /></label><label>Email address<input required type="email" name="email" placeholder="you@example.com" /></label></div>
            <label>Subject<input required name="subject" placeholder="What can we help with?" /></label>
            <label>Message<textarea required name="message" rows="5" placeholder="Tell us a little more..." /></label>
            {submitted && <p className="contact-success">Thanks for reaching out. We will be in touch soon.</p>}
            <button type="submit" className="story-button">Send message <Mail size={15} /></button>
          </form>
        </section>
      </main></ScrollReveal>
      <Footer />
    </div>
  )
}

export default Contact
