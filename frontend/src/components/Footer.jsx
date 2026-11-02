import './site-chrome.css'

function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-main">
        <div className="footer-brand">
          <a className="brand footer-logo" href="/" aria-label="Maison Bistro home">
            <img src="/images/logo.png" alt="Maison Bistro" />
          </a>
          <p>Freshly prepared food, made with care for every table.</p>
        </div>

        <div className="footer-column">
          <h2>Company</h2>
          <a href="/about">About us</a>
          <a href="/contact">Contact us</a>
        </div>

        <div className="footer-column">
          <h2>Explore</h2>
          <a href="#menu">Our menu</a>
          <a href="/categories">Categories</a>
        </div>

        <div className="footer-column">
          <h2>Support</h2>
          <a href="#faq">FAQ</a>
          <a href="#privacy">Privacy policy</a>
          <a href="#terms">Terms &amp; conditions</a>
        </div>
      </div>

      <div className="footer-bottom">
        <span>© 2025 Maison Bistro. All rights reserved.</span>
        <div className="social-links" aria-label="Social media links">
          <a href="#facebook" aria-label="Facebook">f</a>
          <a href="#instagram" aria-label="Instagram">ig</a>
          <a href="#twitter" aria-label="Twitter">x</a>
        </div>
      </div>
    </footer>
  )
}

export default Footer
