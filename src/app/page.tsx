"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { Users, TrendingUp, ShoppingCart, Euro } from "lucide-react";

const chartData = [
  { mes: "Jan", vendas: 1200 },
  { mes: "Fev", vendas: 1900 },
  { mes: "Mar", vendas: 1500 },
  { mes: "Abr", vendas: 2400 },
  { mes: "Mai", vendas: 2100 },
  { mes: "Jun", vendas: 2800 },
];

const chartConfig = {
  vendas: { label: "Vendas (€)", color: "hsl(var(--chart-1))" },
};

const pedidos = [
  { id: "#001", cliente: "João Silva", valor: "€120,00", estado: "Concluído" },
  { id: "#002", cliente: "Ana Costa", valor: "€85,50", estado: "Pendente" },
  { id: "#003", cliente: "Carlos Matos", valor: "€240,00", estado: "Em curso" },
  { id: "#004", cliente: "Rita Ferreira", valor: "€60,00", estado: "Concluído" },
];

const estadoCor: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  "Concluído": "default",
  "Pendente": "secondary",
  "Em curso": "outline",
};

export default function Home() {
  const [search, setSearch] = useState("");

  const filtrados = pedidos.filter(
    (p) =>
      p.cliente.toLowerCase().includes(search.toLowerCase()) ||
      p.id.includes(search)
  );

  return (
    <div className="min-h-screen bg-muted/40 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">FBR Admin</h1>
          <p className="text-muted-foreground text-sm">Bem-vindo ao painel de administração</p>
        </div>
        <Button onClick={() => toast.success("Relatório exportado com sucesso!")}>
          Exportar Relatório
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Clientes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1.248</div>
            <p className="text-xs text-muted-foreground">+12% este mês</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Receita</CardTitle>
            <Euro className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€24.580</div>
            <p className="text-xs text-muted-foreground">+8% este mês</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pedidos</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">342</div>
            <p className="text-xs text-muted-foreground">+5% este mês</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Crescimento</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+18%</div>
            <Progress value={18} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pedidos">
        <TabsList>
          <TabsTrigger value="pedidos">Pedidos</TabsTrigger>
          <TabsTrigger value="grafico">Gráfico</TabsTrigger>
          <TabsTrigger value="equipa">Equipa</TabsTrigger>
        </TabsList>

        <TabsContent value="pedidos" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pedidos Recentes</CardTitle>
              <CardDescription>Lista dos últimos pedidos do sistema</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <div className="space-y-1 flex-1">
                  <Label htmlFor="search">Pesquisar</Label>
                  <Input
                    id="search"
                    placeholder="Cliente ou nº pedido..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nº</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.map((pedido) => (
                    <TableRow key={pedido.id}>
                      <TableCell className="font-medium">{pedido.id}</TableCell>
                      <TableCell>{pedido.cliente}</TableCell>
                      <TableCell>{pedido.valor}</TableCell>
                      <TableCell>
                        <Badge variant={estadoCor[pedido.estado] ?? "secondary"}>
                          {pedido.estado}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="grafico">
          <Card>
            <CardHeader>
              <CardTitle>Vendas Mensais</CardTitle>
              <CardDescription>Janeiro a Junho 2026</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="mes" />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="vendas" fill="var(--color-vendas)" radius={4} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="equipa">
          <Card>
            <CardHeader>
              <CardTitle>Membros da Equipa</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { nome: "Maria Santos", cargo: "Administradora", iniciais: "MS" },
                { nome: "Pedro Alves", cargo: "Gestor de Vendas", iniciais: "PA" },
                { nome: "Inês Rodrigues", cargo: "Suporte ao Cliente", iniciais: "IR" },
              ].map((membro, i) => (
                <div key={i}>
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback>{membro.iniciais}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-sm">{membro.nome}</p>
                      <p className="text-xs text-muted-foreground">{membro.cargo}</p>
                    </div>
                  </div>
                  {i < 2 && <Separator className="mt-4" />}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
