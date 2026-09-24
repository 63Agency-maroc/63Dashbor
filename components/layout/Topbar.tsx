"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useThemeSettings } from "@/components/providers/ThemeProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { avatarUrl, displayName, roleLabel } from "@/lib/auth/storage";

const staticNotifications = [
  {
    name: "Emma Smith",
    text: "Need to update the details.",
    time: "7 hr ago",
    avatar: "/assets/images/avatar/avatar2.webp",
  },
  {
    name: "Design Team",
    text: "Check your shared folder.",
    time: "6 hr ago",
    initial: "D",
    bg: "bg-success",
  },
  {
    name: "Security Update",
    text: "Password successfully set.",
    time: "5 hr ago",
    icon: "fi fi-rr-lock",
    bg: "bg-dark",
  },
  {
    name: "Invoice #1432",
    text: "has been paid Amount: $899.00",
    time: "5 hr ago",
    icon: "fi fi-rr-shopping-cart",
    bg: "bg-info",
  },
];

export function Topbar() {
  const { settings, toggleTheme, toggleSidebar } = useThemeSettings();
  const { user, logout, displayName: authDisplayName } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const themeActive = mounted && settings.appTheme === "dark";
  const userName = authDisplayName || displayName(user);
  const userEmail = user?.email || "";
  const userRole = roleLabel(typeof user?.role === "string" ? user.role : undefined);
  const userAvatar = avatarUrl(user);

  return (
    <>
      <header className="app-header">
        <div className="app-header-inner">
          <button className="app-toggler" type="button" aria-label="app toggler" onClick={toggleSidebar}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M7.66699 12.6668L3.66699 8.00016L7.66699 3.3335"
                stroke="#1C274C"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                opacity="0.5"
                d="M12.667 12.6668L8.66699 8.00016L12.667 3.3335"
                stroke="#1C274C"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          <div className="app-header-start d-none d-md-flex">
            <form className="d-flex align-items-center h-100 w-lg-250px w-xxl-300px position-relative" action="#">
              <button
                type="button"
                className="btn btn-sm border-0 position-absolute start-0 ms-3 p-0"
                style={{ zIndex: 2 }}
                data-bs-toggle="modal"
                data-bs-target="#searchResultsModal"
                aria-label="Search"
              >
                <i className="fi fi-rr-search" />
              </button>
              <input
                type="text"
                className="form-control form-control-fill ps-5"
                placeholder="Search anything's"
                data-bs-toggle="modal"
                data-bs-target="#searchResultsModal"
                readOnly
              />
            </form>
            <div className="badge-standard d-none d-lg-inline-block">
              Today New Leads
              <span className="badge bg-primary-subtle text-primary">27</span>
            </div>
          </div>

          <div className="app-header-end">
            <div className="px-lg-4 px-2 ps-0 d-flex align-items-center">
              <a
                href="#"
                className={`theme-btn${themeActive ? " active" : ""}`}
                onClick={(e) => {
                  e.preventDefault();
                  toggleTheme();
                }}
                aria-label="Toggle theme"
              >
                <svg className="icon-light" width="20" height="21" viewBox="0 0 20 21" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M14.1663 10.5002C14.1663 12.8013 12.3008 14.6668 9.99967 14.6668C7.69849 14.6668 5.83301 12.8013 5.83301 10.5002C5.83301 8.19898 7.69849 6.3335 9.99967 6.3335C12.3008 6.3335 14.1663 8.19898 14.1663 10.5002Z"
                    fill="var(--bs-heading-color)"
                  />
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M10.0003 1.5415C10.3455 1.5415 10.6253 1.82133 10.6253 2.1665V3.83317C10.6253 4.17834 10.3455 4.45817 10.0003 4.45817C9.65516 4.45817 9.37532 4.17834 9.37532 3.83317V2.1665C9.37532 1.82133 9.65516 1.5415 10.0003 1.5415ZM1.04199 10.4998C1.04199 10.1547 1.32182 9.87484 1.66699 9.87484H3.33366C3.67883 9.87484 3.95866 10.1547 3.95866 10.4998C3.95866 10.845 3.67883 11.1248 3.33366 11.1248H1.66699C1.32182 11.1248 1.04199 10.845 1.04199 10.4998ZM16.042 10.4998C16.042 10.1547 16.3218 9.87484 16.667 9.87484H18.3337C18.6788 9.87484 18.9587 10.1547 18.9587 10.4998C18.9587 10.845 18.6788 11.1248 18.3337 11.1248H16.667C16.3218 11.1248 16.042 10.845 16.042 10.4998ZM10.0003 16.5415C10.3455 16.5415 10.6253 16.8213 10.6253 17.1665V18.8332C10.6253 19.1783 10.3455 19.4582 10.0003 19.4582C9.65516 19.4582 9.37532 19.1783 9.37532 18.8332V17.1665C9.37532 16.8213 9.65516 16.5415 10.0003 16.5415Z"
                    fill="var(--bs-heading-color)"
                  />
                  <g opacity="0.5">
                    <path
                      d="M3.05729 3.59633C3.29021 3.34158 3.68554 3.32389 3.94029 3.55681L5.79198 5.24979C6.04673 5.48271 6.06442 5.87804 5.8315 6.13279C5.59858 6.38754 5.20325 6.40524 4.94851 6.17232L3.09683 4.47933C2.84208 4.24642 2.82438 3.85108 3.05729 3.59633Z"
                      fill="var(--bs-heading-color)"
                    />
                    <path
                      d="M16.9428 3.59633C17.1758 3.85108 17.1581 4.24642 16.9033 4.47933L15.0516 6.17232C14.7968 6.40524 14.4015 6.38754 14.1686 6.13279C13.9357 5.87804 13.9534 5.48271 14.2082 5.24979L16.0598 3.55681C16.3146 3.32389 16.7099 3.34158 16.9428 3.59633Z"
                      fill="var(--bs-heading-color)"
                    />
                    <path
                      d="M14.188 14.6874C14.4321 14.4433 14.8277 14.4434 15.0718 14.6875L16.9235 16.5394C17.1676 16.7835 17.1676 17.1792 16.9235 17.4232C16.6794 17.6673 16.2837 17.6673 16.0396 17.4232L14.1879 15.5713C13.9438 15.3272 13.9439 14.9315 14.188 14.6874Z"
                      fill="var(--bs-heading-color)"
                    />
                    <path
                      d="M5.81235 14.6875C6.05643 14.9315 6.05643 15.3272 5.81235 15.5713L3.9605 17.4231C3.71642 17.6672 3.32069 17.6672 3.07662 17.4231C2.83253 17.179 2.83253 16.7834 3.07662 16.5393L4.92847 14.6874C5.17254 14.4434 5.56828 14.4434 5.81235 14.6875Z"
                      fill="var(--bs-heading-color)"
                    />
                  </g>
                </svg>
                <div className="theme-toggle" />
                <svg className="icon-dark" width="20" height="21" viewBox="0 0 20 21" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M16.5835 2.4225C16.4495 2.08117 15.9681 2.08117 15.834 2.4225L15.4754 3.33523C15.4345 3.43944 15.3523 3.52193 15.2485 3.56303L14.339 3.92301C13.999 4.05762 13.999 4.54067 14.339 4.67529L15.2485 5.03527C15.3523 5.07637 15.4345 5.15886 15.4754 5.26306L15.834 6.1758C15.9681 6.51712 16.4495 6.51712 16.5835 6.17581L16.9422 5.26306C16.9831 5.15886 17.0653 5.07637 17.1691 5.03527L18.0785 4.67529C18.4186 4.54067 18.4186 4.05762 18.0785 3.92301L17.1691 3.56303C17.0653 3.52193 16.9831 3.43944 16.9422 3.33523L16.5835 2.4225Z"
                    fill="var(--bs-heading-color)"
                  />
                  <path
                    d="M13.3609 7.27454C13.2267 6.93323 12.7455 6.93323 12.6113 7.27454L12.4806 7.60733C12.4396 7.71154 12.3575 7.79403 12.2536 7.83513L11.9221 7.96638C11.582 8.10099 11.582 8.58404 11.9221 8.71866L12.2536 8.8499C12.3575 8.89098 12.4396 8.97348 12.4806 9.07773L12.6113 9.41048C12.7455 9.75182 13.2267 9.75182 13.3609 9.41048L13.4916 9.07773C13.5326 8.97348 13.6147 8.89098 13.7186 8.8499L14.0501 8.71866C14.3902 8.58404 14.3902 8.10099 14.0501 7.96638L13.7186 7.83513C13.6147 7.79403 13.5326 7.71154 13.4916 7.60733L13.3609 7.27454Z"
                    fill="var(--bs-heading-color)"
                  />
                  <path
                    opacity="0.5"
                    d="M10.0003 18.8332C14.6027 18.8332 18.3337 15.1022 18.3337 10.4998C18.3337 10.1143 17.7557 10.0505 17.5563 10.3805C16.6077 11.9503 14.8849 12.9998 12.917 12.9998C9.92541 12.9998 7.50032 10.5748 7.50032 7.58317C7.50032 5.61521 8.54982 3.89238 10.1197 2.9438C10.4497 2.7444 10.3859 2.1665 10.0003 2.1665C5.39795 2.1665 1.66699 5.89746 1.66699 10.4998C1.66699 15.1022 5.39795 18.8332 10.0003 18.8332Z"
                    fill="var(--bs-heading-color)"
                  />
                </svg>
              </a>
            </div>

            <div className="vr my-3" />

            <div className="d-flex align-items-center gap-sm-2 gap-0 px-lg-4 px-sm-2 px-1">
              <Link href="/email" className="btn btn-icon btn-action-gray rounded-circle waves-effect waves-light position-relative">
                <svg width="24" height="25" viewBox="0 0 24 25" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    opacity="0.5"
                    d="M22 11V12.5C22 17.214 22 19.5711 20.5355 21.0355C19.0711 22.5 16.714 22.5 12 22.5C7.28595 22.5 4.92893 22.5 3.46447 21.0355C2 19.5711 2 17.214 2 12.5C2 7.78595 2 5.42893 3.46447 3.96447C4.92893 2.5 7.28595 2.5 12 2.5H13.5"
                    stroke="var(--bs-heading-color)"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M19 8.5C20.6569 8.5 22 7.15685 22 5.5C22 3.84315 20.6569 2.5 19 2.5C17.3431 2.5 16 3.84315 16 5.5C16 7.15685 17.3431 8.5 19 8.5Z"
                    stroke="var(--bs-heading-color)"
                    strokeWidth="2"
                  />
                  <path d="M7 14.5H16" stroke="var(--bs-heading-color)" strokeWidth="2" strokeLinecap="round" />
                  <path d="M7 18H13" stroke="var(--bs-heading-color)" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <span className="position-absolute top-0 end-0 p-1 mt-1 me-1 bg-primary border border-3 border-light rounded-circle">
                  <span className="visually-hidden">New alerts</span>
                </span>
              </Link>

              <div className="dropdown text-end">
                <button
                  type="button"
                  className="btn btn-icon btn-action-gray rounded-circle waves-effect waves-light"
                  data-bs-toggle="dropdown"
                  data-bs-auto-close="outside"
                  aria-expanded="false"
                >
                  <svg width="24" height="25" viewBox="0 0 24 25" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M18.7491 10.2096V9.50497C18.7491 5.63623 15.7274 2.5 12 2.5C8.27256 2.5 5.25087 5.63623 5.25087 9.50497V10.2096C5.25087 11.0552 5.00972 11.8818 4.5578 12.5854L3.45036 14.3095C2.43882 15.8843 3.21105 18.0249 4.97036 18.5229C9.57274 19.8257 14.4273 19.8257 19.0296 18.5229C20.789 18.0249 21.5612 15.8843 20.5496 14.3095L19.4422 12.5854C18.9903 11.8818 18.7491 11.0552 18.7491 10.2096Z"
                      stroke="var(--bs-heading-color)"
                      strokeWidth="2"
                    />
                    <path
                      opacity="0.5"
                      d="M7.5 19.5C8.15503 21.2478 9.92246 22.5 12 22.5C14.0775 22.5 15.845 21.2478 16.5 19.5"
                      stroke="var(--bs-heading-color)"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <path
                      opacity="0.5"
                      d="M12 6.5V10.5"
                      stroke="var(--bs-heading-color)"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
                <div className="dropdown-menu dropdown-menu-lg-end p-0 w-300px mt-2">
                  <div className="px-3 py-3 border-bottom d-flex justify-content-between align-items-center">
                    <h6 className="mb-0">
                      Notifications <span className="badge badge-sm rounded-pill bg-primary ms-2">9</span>
                    </h6>
                    <i className="bi bi-x-lg cursor-pointer" />
                  </div>
                  <div className="p-2" style={{ height: 300 }} data-simplebar>
                    <ul className="list-group list-group-hover list-group-smooth list-group-unlined">
                      {staticNotifications.map((n) => (
                        <li className="list-group-item d-flex justify-content-between align-items-center" key={n.name + n.time}>
                          {n.avatar ? (
                            <div className="avatar avatar-xs avatar-status-success rounded-circle me-1">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={n.avatar} alt="" />
                            </div>
                          ) : (
                            <div className={`avatar avatar-xs ${n.bg ?? "bg-dark"} rounded-circle text-white`}>
                              {n.icon ? <i className={n.icon} /> : n.initial}
                            </div>
                          )}
                          <div className="ms-2 me-auto">
                            <h6 className="mb-0">{n.name}</h6>
                            <small className="text-body d-block">{n.text}</small>
                            <small className="text-muted position-absolute end-0 top-0 mt-2 me-3">{n.time}</small>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="p-2">
                    <Link href="/notifications" className="btn w-100 btn-primary waves-effect waves-light">
                      View all notifications
                    </Link>
                  </div>
                </div>
              </div>

              <Link href="/calendar" className="btn btn-icon btn-action-gray rounded-circle waves-effect waves-light">
                <svg width="24" height="25" viewBox="0 0 24 25" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M2 12.5C2 8.72876 2 6.84315 3.17157 5.67157C4.34315 4.5 6.22876 4.5 10 4.5H14C17.7712 4.5 19.6569 4.5 20.8284 5.67157C22 6.84315 22 8.72876 22 12.5V14.5C22 18.2712 22 20.1569 20.8284 21.3284C19.6569 22.5 17.7712 22.5 14 22.5H10C6.22876 22.5 4.34315 22.5 3.17157 21.3284C2 20.1569 2 18.2712 2 14.5V12.5Z"
                    stroke="var(--bs-heading-color)"
                    strokeWidth="2"
                  />
                  <path opacity="0.5" d="M7 4.5V3" stroke="var(--bs-heading-color)" strokeWidth="2" strokeLinecap="round" />
                  <path opacity="0.5" d="M17 4.5V3" stroke="var(--bs-heading-color)" strokeWidth="2" strokeLinecap="round" />
                  <path opacity="0.5" d="M2.5 9.5H21.5" stroke="var(--bs-heading-color)" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </Link>
            </div>

            <div className="vr my-3" />

            <div className="dropdown text-end ms-sm-3 ms-2 ms-lg-4">
              <a
                href="#"
                className="d-flex align-items-center py-2"
                data-bs-toggle="dropdown"
                data-bs-auto-close="outside"
                aria-expanded="false"
                onClick={(e) => e.preventDefault()}
              >
                <div className="text-end me-2 d-none d-lg-inline-block">
                  <div className="fw-bold text-dark">{userName}</div>
                  <small className="text-body d-block lh-sm">
                    <i className="fi fi-rr-angle-down text-3xs me-1" /> {userRole}
                  </small>
                </div>
                <div className="avatar avatar-sm rounded-circle avatar-status-success">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={userAvatar} alt="" />
                </div>
              </a>
              <ul className="dropdown-menu dropdown-menu-end w-225px mt-1">
                <li className="d-flex align-items-center p-2">
                  <div className="avatar avatar-sm rounded-circle">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={userAvatar} alt="" />
                  </div>
                  <div className="ms-2">
                    <div className="fw-bold text-dark">{userName}</div>
                    <small className="text-body d-block lh-sm">{userEmail}</small>
                  </div>
                </li>
                <li>
                  <div className="dropdown-divider my-1" />
                </li>
                <li>
                  <Link className="dropdown-item d-flex align-items-center gap-2" href="/profile">
                    <i className="fi fi-rr-user scale-1x" /> View Profile
                  </Link>
                </li>
                <li>
                  <Link className="dropdown-item d-flex align-items-center gap-2" href="/settings">
                    <i className="fi fi-rr-settings scale-1x" /> Account Settings
                  </Link>
                </li>
                <li>
                  <div className="dropdown-divider my-1" />
                </li>
                <li>
                  <button
                    type="button"
                    className="dropdown-item d-flex align-items-center gap-2 text-danger"
                    onClick={() => logout()}
                  >
                    <i className="fi fi-sr-exit scale-1x" /> Log Out
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </header>

      <div className="modal fade" id="searchResultsModal" tabIndex={-1} aria-hidden="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header py-1 px-3">
              <form className="d-flex align-items-center position-relative w-100" action="#">
                <button type="button" className="btn btn-sm border-0 position-absolute start-0 p-0 text-sm">
                  <i className="fi fi-rr-search" />
                </button>
                <input
                  type="text"
                  className="form-control form-control-lg ps-4 border-0 shadow-none"
                  id="searchInput"
                  placeholder="Search anything's"
                />
              </form>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close" />
            </div>
            <div className="modal-body pb-2" style={{ height: 300 }} data-simplebar>
              <div id="recentlyResults">
                <span className="text-uppercase text-2xs fw-semibold text-muted d-block mb-2">Recently Searched:</span>
                <ul className="list-inline search-list">
                  <li>
                    <Link className="search-item" href="/">
                      <i className="fi fi-rr-apps" /> Dashboard
                    </Link>
                  </li>
                  <li>
                    <Link className="search-item" href="/customers">
                      <i className="fi fi-rr-review" /> Customers
                    </Link>
                  </li>
                  <li>
                    <Link className="search-item" href="/calendar">
                      <i className="fi fi-rr-calendar" /> Calendar
                    </Link>
                  </li>
                  <li>
                    <Link className="search-item" href="/email">
                      <i className="fi fi-rr-envelope" /> Email
                    </Link>
                  </li>
                </ul>
              </div>
              <div id="searchContainer" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
