import { BRAND_NAME } from "@/lib/constants/brand";

export function Footer() {
  return (
    <footer className="footer-wrapper bg-body">
      <div className="container-fluid">
        <div className="row g-2">
          <div className="col-lg-6 col-md-7 text-center text-md-start">
            <p className="mb-0">
              © <span className="currentYear">2026</span> {BRAND_NAME}.
            </p>
          </div>
          <div className="col-lg-6 col-md-5">
            <ul className="d-flex list-inline mb-0 gap-3 flex-wrap justify-content-center justify-content-md-end">
              <li>
                <a className="text-body" href="/">
                  Home
                </a>
              </li>
              <li>
                <a className="text-body" href="#">
                  Support
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
