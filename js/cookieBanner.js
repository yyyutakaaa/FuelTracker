export function showCookieBanner() {
  if (!localStorage.getItem("cookiesAccepted")) {
    const banner = document.createElement("div");
    banner.id = "cookieBanner";
    banner.innerHTML = `
      <div class="cookie-banner-content">
        <p>Deze website gebruikt cookies voor een betere ervaring.</p>
        <button id="acceptCookies" class="button is-primary">Accepteren</button>
      </div>
    `;
    document.body.appendChild(banner);
    const style = document.createElement("style");
    style.textContent = `
      #cookieBanner {
        position: fixed;
        bottom: 0;
        left: 0;
        width: 100%;
        background: rgba(30, 30, 30, 0.7);
        backdrop-filter: blur(6px);
        color: #fff;
        padding: 15px;
        text-align: center;
        z-index: 3000;
      }
      #cookieBanner .cookie-banner-content {
        max-width: 960px;
        margin: 0 auto;
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      #cookieBanner p {
        margin: 0 0 10px 0;
      }
    `;
    document.head.appendChild(style);
    document.getElementById("acceptCookies").addEventListener("click", () => {
      localStorage.setItem("cookiesAccepted", "true");
      banner.remove();
    });
  }
}
