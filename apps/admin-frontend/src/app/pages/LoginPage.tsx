/**
 * Login Page - Authentication with Phone/Password and Cloudflare Turnstile Captcha
 */

import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { useAuth } from '../context/AuthContext';
import { Phone, Lock, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import TurnstileWidget, { TurnstileWidgetRef } from '../components/auth/TurnstileWidget';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [turnstileToken, setTurnstileToken] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const turnstileRef = useRef<TurnstileWidgetRef>(null);

  const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || !password) {
      toast.error('Please enter phone and password');
      return;
    }

    if (turnstileSiteKey && !turnstileToken) {
      toast.error('Please complete the security verification challenge');
      return;
    }

    setLoading(true);
    try {
      await login(phone, password, turnstileToken);
      toast.success('Login successful');
      navigate('/dashboard');
    } catch (error: any) {
      toast.error(error?.message || 'Invalid credentials');
      // Reset captcha on failed login attempt
      setTurnstileToken('');
      turnstileRef.current?.reset();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-border shadow-lg">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto w-16 h-16 bg-primary rounded-full flex items-center justify-center mb-2">
            <Lock className="w-8 h-8 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">MaiHoonNa</CardTitle>
          <CardDescription>Senior Care Operations Portal</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+91-9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="pl-10 bg-input-background"
                  disabled={loading}
                />
              </div>
              <p className="text-xs text-muted-foreground">Demo: +91-9876543210</p>
            </div>

            <div className="space-y-2 mt-4">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 bg-input-background"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Cloudflare Turnstile Captcha Protection */}
            {turnstileSiteKey && (
              <div className="space-y-2 mt-4">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground justify-center">
                  <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                  <span>Security Verification</span>
                </div>
                <TurnstileWidget
                  ref={turnstileRef}
                  siteKey={turnstileSiteKey}
                  onVerify={(token) => setTurnstileToken(token)}
                  onExpire={() => setTurnstileToken('')}
                  onError={() => {
                    setTurnstileToken('');
                    toast.error('Security challenge failed. Please refresh or retry.');
                  }}
                />
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 mt-6"
              disabled={loading || (Boolean(turnstileSiteKey) && !turnstileToken)}
            >
              {loading ? 'Logging in...' : 'Login'}
            </Button>
          </form>
          <div className="text-center text-xs text-muted-foreground pt-4 border-t border-border">
            <p>© 2026 MaiHoonNa Senior Care</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
