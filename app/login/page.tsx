'use client'

import { ChangeEvent, FormEvent, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from '@prodexy/ui'
import { brand } from '@/branding/brand'
import { getRoleHome, isUserRole, type AuthProfile } from '@/lib/auth'
import { supabase } from '@/lib/supabase-client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (signInError || !data.user) {
        setError('Email ou senha inválidos.')
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from('perfis')
        .select('papel, ativo')
        .eq('id', data.user.id)
        .single<AuthProfile>()

      if (profileError || !profile || !isUserRole(profile.papel)) {
        await supabase.auth.signOut()
        setError('Seu usuário não possui um perfil de acesso válido.')
        return
      }

      if (!profile.ativo) {
        await supabase.auth.signOut()
        setError('Seu acesso está inativo. Entre em contato com o administrador.')
        return
      }

      router.replace(getRoleHome(profile.papel))
      router.refresh()
    } catch {
      setError('Não foi possível entrar agora. Tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4">
      <Card className="w-full max-w-md shadow-sm">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto flex size-16 items-center justify-center overflow-hidden rounded-xl bg-card">
            <img src={brand.logoUrl} alt={brand.appName} className="h-full w-full object-cover" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-2xl">{brand.appName}</CardTitle>
            <CardDescription>Acesse o sistema com seu email e senha.</CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setEmail(event.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setPassword(event.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>

            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>

          <div className="mt-5 border-t border-border pt-4 text-center">
            <Link
              href="/politica-de-privacidade"
              className="text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Política de Privacidade
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
