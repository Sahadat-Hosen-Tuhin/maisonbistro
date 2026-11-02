import { ArrowRight, Award, Heart, Leaf, Users } from 'lucide-react'
import Header from '../components/Header'
import Footer from '../components/Footer'
import './story.css'
import { LogoLoader, ScrollReveal } from '../components/PublicEnhancements'
import usePublicLoader from '../components/usePublicLoader'

function About() {
  const loading = usePublicLoader()
  if (loading) return <div className="landing-page"><Header /><LogoLoader label="Welcome to Maison Bistro..." /></div>
  return (
    <div className="landing-page">
      <Header />
      <ScrollReveal><main className="story-page">
        <section className="story-hero">
          <div>
            <p className="menu-kicker">OUR STORY / MAISON BISTRO</p>
            <h1>Good food brings<br /><em>people closer.</em></h1>
            <p className="story-lead">We believe a great meal is more than what is on the plate. It is the warmth of a shared table, the comfort of familiar flavours, and a little joy in every bite.</p>
            <a className="story-button" href="/menu">Explore our menu <ArrowRight size={15} /></a>
          </div>
          <div className="story-hero-art"><div className="story-art-circle">M</div><span>Made fresh<br />with care</span></div>
        </section>
        <section className="story-intro">
          <div><p className="menu-kicker">WHY MAISON</p><h2>A neighbourhood table<br />with a big heart.</h2></div>
          <p>Maison Bistro was created for the moments that matter: a quick lunch, a late-night craving, a family celebration, or simply a quiet meal that feels like home. Every recipe is prepared with thoughtful ingredients and served with genuine hospitality.</p>
        </section>
        <section className="story-values">
          <article><span><Leaf size={19} /></span><h3>Fresh by nature</h3><p>We choose quality ingredients and prepare every order with care, never cutting corners.</p></article>
          <article><span><Heart size={19} /></span><h3>Made with heart</h3><p>From our kitchen to your table, every detail is guided by warmth and a love for good food.</p></article>
          <article><span><Users size={19} /></span><h3>For every table</h3><p>Come as you are. There is always room for one more at the Maison table.</p></article>
          <article><span><Award size={19} /></span><h3>Always memorable</h3><p>We turn everyday dining into moments you will want to come back to.</p></article>
        </section>
        <section className="story-quote"><p>“The best memories are made around a table.”</p><span>— The Maison Bistro team</span></section>
      </main></ScrollReveal>
      <Footer />
    </div>
  )
}

export default About
