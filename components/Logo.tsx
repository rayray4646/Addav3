import React from 'react';

interface LogoProps {
  className?: string;
  classNameColor?: string;
}

const Logo: React.FC<LogoProps> = ({ className = "w-8 h-8", classNameColor = "text-orange" }) => {
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={`${className} ${classNameColor}`}
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
      <circle cx="9" cy="7" r="4"></circle>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
    </svg>
  );
};

export const CustomLogo: React.FC<LogoProps> = ({ className = "w-10 h-10", classNameColor = "text-orange" }) => {
  return (
    <svg 
      viewBox="0 0 100 100" 
      className={`${className} ${classNameColor}`}
      xmlns="http://www.w3.org/2000/svg"
    >
       {/* Heads */}
       <circle cx="30" cy="35" r="10" fill="none" stroke="currentColor" strokeWidth="6" />
       <circle cx="50" cy="28" r="10" fill="none" stroke="currentColor" strokeWidth="6" />
       <circle cx="70" cy="35" r="10" fill="none" stroke="currentColor" strokeWidth="6" />

       {/* Bodies/Arms connection */}
       <path d="M20 90 V 65 Q 20 50 35 50 H 65 Q 80 50 80 65 V 90" stroke="currentColor" strokeWidth="6" fill="none" strokeLinecap="round" />
       
       {/* Central Body Lines */}
       <path d="M50 50 V 90" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
       <path d="M35 50 V 90" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
       <path d="M65 50 V 90" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
    </svg>
  )
}

export default CustomLogo;
