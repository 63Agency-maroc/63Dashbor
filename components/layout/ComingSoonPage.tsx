type Props = {
  title: string;
  description?: string;
};

/** Page placeholder NexLink — routes pas encore branchées. */
export function ComingSoonPage({ title, description }: Props) {
  return (
    <div className="container-fluid">
      <div className="app-page-head">
        <nav aria-label="breadcrumb">
          <ol className="breadcrumb mb-0">
            <li className="breadcrumb-item">
              <a href="/">
                <i className="fi fi-rr-home" /> Home
              </a>
            </li>
            <li className="breadcrumb-item active" aria-current="page">
              {title}
            </li>
          </ol>
        </nav>
      </div>
      <div className="card">
        <div className="card-body text-center py-5">
          <div className="avatar avatar-lg bg-primary-subtle text-primary rounded-circle mx-auto mb-3 d-flex align-items-center justify-content-center">
            <i className="fi fi-rr-time-forward scale-2x" />
          </div>
          <h4 className="mb-2">{title}</h4>
          <p className="text-muted mb-0">
            {description ?? "Cette page sera disponible prochainement."}
          </p>
        </div>
      </div>
    </div>
  );
}
