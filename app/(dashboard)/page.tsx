export default function DashboardHomePage() {
  return (
    <div className="container-fluid">
      <div className="app-page-head d-flex align-items-center justify-content-between">
        <nav aria-label="breadcrumb">
          <ol className="breadcrumb mb-0">
            <li className="breadcrumb-item">
              <a href="/">
                <i className="fi fi-rr-home" /> Home
              </a>
            </li>
            <li className="breadcrumb-item active" aria-current="page">
              Dashboard
            </li>
          </ol>
        </nav>
      </div>

      <div className="row">
        <div className="col-12">
          <div className="card">
            <div className="card-body py-5 text-center">
              <h1 className="h3 mb-2">Dashboard</h1>
              <p className="text-muted mb-0">
                Bienvenue sur le dashboard 63 Agency. Contenu métier à brancher ensuite.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
