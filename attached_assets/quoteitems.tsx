    <section aria-label="Itens da Cotação" className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Itens da Cotação</h2>
        <Button variant="secondary" size="sm" onClick={addRow}>
          <Plus className="h-4 w-4 mr-1" /> Adicionar item
        </Button>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/50 sticky top-0 z-10">
            <TableRow>
              <TableHead className="min-w-[260px]">Item</TableHead>
              <TableHead className="min-w-[160px]">Marca / Modelo</TableHead>
              <TableHead className="min-w-[150px] text-right">Preço + Original</TableHead>
              <TableHead className="w-[90px] text-right">Desc. %</TableHead>
              <TableHead className="min-w-[120px] text-right">Desc. Valor</TableHead>
              <TableHead className="w-[110px] text-right">Prazo (dias)</TableHead>
              <TableHead className="min-w-[130px] text-right">Total Final</TableHead>
              <TableHead className="w-[40px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const { totalOriginal, totalFinal } = computeTotals(item);
              return (
                <TableRow key={item.id} className="text-sm">
                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-medium">{item.descricao}</div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="secondary" className="h-5 px-2">{item.quantidade}</Badge>
                        <span>{item.unidade}</span>
                      </div>
                      <div
                        className="text-xs text-muted-foreground truncate"
                        title={item.observacoes || "Sem observações"}
                      >
                        {item.observacoes || "Sem observações"}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="grid gap-1">
                      <Input
                        value={item.marca}
                        onChange={(e) => update(item.id, { marca: e.target.value })}
                        className="h-8"
                        placeholder="Marca"
                      />
                      <Input
                        value={item.modelo}
                        onChange={(e) => update(item.id, { modelo: e.target.value })}
                        className="h-8"
                        placeholder="Modelo"
                      />
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      value={item.precoUnitario}
                      onChange={(e) => update(item.id, { precoUnitario: Number(e.target.value) || 0 })}
                      className="h-8 text-right"
                    />
                    <div className="text-[11px] text-muted-foreground mt-1">
                      Original: {currency.format(totalOriginal)}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      value={item.descontoPercent}
                      onChange={(e) => update(item.id, { descontoPercent: Number(e.target.value) || 0 })}
                      className="h-8 text-right"
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      value={item.descontoValor}
                      onChange={(e) => update(item.id, { descontoValor: Number(e.target.value) || 0 })}
                      className="h-8 text-right"
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      inputMode="numeric"
                      value={item.prazoDias}
                      onChange={(e) => update(item.id, { prazoDias: Number(e.target.value) || 0 })}
                      className="h-8 text-right"
                    />
                  </TableCell>
                  <TableCell className="text-right align-middle">
                    <span className={cn("font-semibold", "text-success")}>
                      {currency.format(totalFinal)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => remove(item.id)} aria-label="Remover item">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            <TableRow>
              <TableCell colSpan={6} className="text-right font-medium">Subtotal</TableCell>
              <TableCell className="text-right font-semibold text-success">{currency.format(subtotal)}</TableCell>
              <TableCell />
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <p className="text-sm text-muted-foreground">Dica: passe o mouse sobre o campo de observações para visualizar o conteúdo completo.</p>
    </section>