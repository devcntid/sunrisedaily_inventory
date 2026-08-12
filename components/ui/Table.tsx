import React from 'react';

interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  children: React.ReactNode;
  responsive?: boolean;
}

export function Table({ children, responsive = true, className = '', ...props }: TableProps) {
  const tbl = <table className={className} {...props}>{children}</table>;
  if (responsive) {
    return <div className="table-responsive">{tbl}</div>;
  }
  return tbl;
}
