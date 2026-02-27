import React, { useState } from 'react';
import { supabase, isConfigured } from '../lib/supabase';
import Button from './Button';
import { AlertTriangle, CheckCircle, AlertCircle, ArrowRight, Mail, Key, ArrowLeft } from 'lucide-react';
import CustomLogo from './Logo';

const Auth = () => {
  const [view, setView] = useState<'login' | 'signup' | 'forgot_password'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const clearState = () => {
    setError(null);
    setSuccessMsg(null);
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    if (!isConfigured) {
        setError("Supabase not configured.");
        return;
    }
    setLoading(true);
    try {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin,
            }
        });
        if (error) throw error;
    } catch (err: any) {
        setError(err.message);
        setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return setError("Please enter your email address.");
    
    setLoading(true);
    setError(null);

    try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + '/update-password',
        });
        if (error) throw error;
        setSuccessMsg("Check your email for the password reset link.");
    } catch (err: any) {
        setError(err.message);
    } finally {
        setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConfigured) {
      setError("Cannot connect: Supabase credentials are missing.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      if (view === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      } else if (view === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name: name || email.split('@')[0], 
            },
          },
        });
        if (error) throw error;

        if (data.user && !data.session) {
          setSuccessMsg("Account created! Please check your email to confirm your account.");
        }
      }
    } catch (err: any) {
      console.error("Auth Error:", err);
      if (err.message.includes("Email not confirmed")) {
        setError("Your email address has not been confirmed yet.");
      } else if (err.message.includes("Invalid login credentials")) {
        setError("Incorrect email or password.");
      } else if (err.message.includes("User already registered")) {
         setError("This email is already registered. Please sign in.");
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  // Google SVG Icon
  const GoogleIcon = () => (
    <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );

  return (
    <div className="p-6 flex flex-col items-center justify-center min-h-[90vh] bg-bg font-sans">
      <div className="w-full max-w-sm space-y-6 bg-surface sm:p-8 sm:rounded-card sm:shadow-lg sm:border sm:border-border">
        
        {/* Header */}
        <div className="text-center">
            <div className="flex justify-center mb-4">
                <CustomLogo className="w-16 h-16" classNameColor="text-orange" />
            </div>
            <h2 className="text-3xl font-serif text-navy">
                {view === 'login' && 'Welcome Back 👋'}
                {view === 'signup' && 'Create Account ✨'}
                {view === 'forgot_password' && 'Reset Password 🔑'}
            </h2>
            <p className="mt-2 text-sm text-mid">
                {view === 'login' && 'Enter your details to sign in.'}
                {view === 'signup' && 'Join the community today.'}
                {view === 'forgot_password' && 'Enter your email to receive a reset link.'}
            </p>
        </div>

        {!isConfigured && (
          <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-md shadow-sm">
            <div className="flex">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
              <div className="ml-3">
                <p className="text-xs text-amber-700">
                  Missing Configuration. Check <code>.env</code> file.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* FORMS */}
        {view === 'forgot_password' ? (
             <form className="space-y-4" onSubmit={handlePasswordReset}>
                 <div>
                    <label className="block text-sm font-bold text-navy mb-1 uppercase tracking-wide">Email address</label>
                    <div className="relative mt-1">
                        <Mail className="absolute left-3 top-3 text-mid" size={18} />
                        <input
                            type="email"
                            required
                            className="block w-full rounded-xl border border-border bg-bg pl-10 pr-3 py-3 text-navy focus:border-orange focus:ring-1 focus:ring-orange focus:outline-none sm:text-sm transition-colors"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                </div>
                
                {error && <p className="text-red-500 text-sm bg-red-50 p-2 rounded">{error}</p>}
                {successMsg && <p className="text-green-600 text-sm bg-green-50 p-2 rounded">{successMsg}</p>}

                <Button type="submit" fullWidth loading={loading} size="lg">
                    Send Reset Link
                </Button>
                
                <button 
                    type="button"
                    onClick={() => { setView('login'); clearState(); }}
                    className="w-full text-sm text-mid hover:text-navy mt-2 flex items-center justify-center gap-1 font-medium"
                >
                    <ArrowLeft size={14} /> Back to Login
                </button>
             </form>
        ) : (
            <>
                <form className="space-y-4" onSubmit={handleSubmit}>
                {view === 'signup' && (
                    <div>
                        <label className="block text-sm font-bold text-navy mb-1 uppercase tracking-wide">Name</label>
                        <input
                        type="text"
                        required
                        className="mt-1 block w-full rounded-xl border border-border bg-bg px-3 py-3 text-navy focus:border-orange focus:ring-1 focus:ring-orange focus:outline-none sm:text-sm transition-colors"
                        placeholder="Your Name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        />
                    </div>
                )}
                
                <div>
                    <label className="block text-sm font-bold text-navy mb-1 uppercase tracking-wide">Email address</label>
                    <div className="relative mt-1">
                        <Mail className="absolute left-3 top-3 text-mid" size={18} />
                        <input
                            type="email"
                            required
                            className="block w-full rounded-xl border border-border bg-bg pl-10 pr-3 py-3 text-navy focus:border-orange focus:ring-1 focus:ring-orange focus:outline-none sm:text-sm transition-colors"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                </div>
                
                <div>
                    <label className="block text-sm font-bold text-navy mb-1 uppercase tracking-wide">Password</label>
                    <div className="relative mt-1">
                        <Key className="absolute left-3 top-3 text-mid" size={18} />
                        <input
                            type="password"
                            required
                            className="block w-full rounded-xl border border-border bg-bg pl-10 pr-3 py-3 text-navy focus:border-orange focus:ring-1 focus:ring-orange focus:outline-none sm:text-sm transition-colors"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                    {view === 'login' && (
                        <div className="flex justify-end mt-1">
                            <button 
                                type="button"
                                onClick={() => { setView('forgot_password'); clearState(); }}
                                className="text-xs font-bold text-orange hover:text-orange-mid"
                            >
                                Forgot password?
                            </button>
                        </div>
                    )}
                </div>

                {error && (
                    <div className="rounded-md bg-red-50 p-3 flex items-start">
                        <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 mr-2 flex-shrink-0" />
                        <div className="text-sm text-red-700">{error}</div>
                    </div>
                )}

                {successMsg && (
                    <div className="rounded-md bg-green-50 p-3 flex items-start">
                        <CheckCircle className="h-4 w-4 text-green-400 mt-0.5 mr-2 flex-shrink-0" />
                        <div className="text-sm text-green-700">{successMsg}</div>
                    </div>
                )}

                <Button type="submit" fullWidth loading={loading} size="lg">
                    {view === 'login' ? 'Sign In' : 'Create Account'}
                </Button>
                </form>

                <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                        <span className="bg-surface sm:bg-surface px-2 text-mid">Or continue with</span>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    className="w-full flex justify-center items-center px-4 py-3 border border-border shadow-sm text-sm font-bold rounded-xl text-navy bg-surface hover:bg-bg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-mid transition-colors"
                >
                    <GoogleIcon />
                    Google
                </button>

                <div className="text-center mt-4">
                    <button
                        type="button"
                        className="text-sm font-medium text-mid hover:text-navy flex items-center justify-center w-full gap-1"
                        onClick={() => {
                            setView(view === 'login' ? 'signup' : 'login');
                            clearState();
                        }}
                    >
                        {view === 'login' ? (
                            <>Don't have an account? <span className='text-orange font-bold'>Sign up</span></>
                        ) : (
                            <>Already have an account? <span className='text-orange font-bold'>Sign in</span></>
                        )}
                    </button>
                </div>
            </>
        )}
      </div>
    </div>
  );
};

export default Auth;
