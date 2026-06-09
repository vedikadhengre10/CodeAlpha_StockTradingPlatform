

package service;

import model.*;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Provides portfolio analytics, performance metrics, and asset allocation data
 */
public class PortfolioService {
    private final MarketService marketService;

    public PortfolioService(MarketService marketService) {
        this.marketService = marketService;
    }

    public double getTotalPortfolioValue(User user) {
        return user.getCashBalance() + getStockValue(user);
    }

    public double getStockValue(User user) {
        return user.getPortfolio().getCurrentValue(marketService.getStockMap());
    }

    public double getTotalInvested(User user) {
        return user.getPortfolio().getTotalInvested(marketService.getStockMap());
    }

    public double getUnrealizedPnL(User user) {
        return user.getPortfolio().getUnrealizedPnL(marketService.getStockMap());
    }

    public double getTotalReturnPercent(User user) {
        double invested = user.getInitialDeposit();
        if (invested == 0) return 0;
        return ((getTotalPortfolioValue(user) - invested) / invested) * 100;
    }

    public double getUnrealizedReturnPercent(User user) {
        double invested = getTotalInvested(user);
        if (invested == 0) return 0;
        return (getUnrealizedPnL(user) / invested) * 100;
    }

    public Map<String, Double> getSectorAllocation(User user) {
        Map<String, Double> allocation = new LinkedHashMap<>();
        Map<String, Holding> holdings = user.getPortfolio().getHoldings();

        double totalValue = getStockValue(user);
        if (totalValue == 0) return allocation;

        Map<String, Double> sectorValues = new HashMap<>();
        for (Map.Entry<String, Holding> entry : holdings.entrySet()) {
            Optional<Stock> stockOpt = marketService.getStock(entry.getKey());
            stockOpt.ifPresent(stock -> {
                double value = stock.getCurrentPrice() * entry.getValue().getQuantity();
                sectorValues.merge(stock.getSector(), value, Double::sum);
            });
        }

        sectorValues.entrySet().stream()
            .sorted(Map.Entry.<String, Double>comparingByValue().reversed())
            .forEach(e -> allocation.put(e.getKey(), (e.getValue() / totalValue) * 100));

        return allocation;
    }

    public List<HoldingSnapshot> getHoldingSnapshots(User user) {
        List<HoldingSnapshot> snapshots = new ArrayList<>();
        for (Map.Entry<String, Holding> entry : user.getPortfolio().getHoldings().entrySet()) {
            Optional<Stock> stockOpt = marketService.getStock(entry.getKey());
            stockOpt.ifPresent(stock -> {
                Holding h = entry.getValue();
                double currentPrice = stock.getCurrentPrice();
                double pnl = h.getUnrealizedPnL(currentPrice);
                double pnlPct = h.getUnrealizedPnLPercent(currentPrice);
                double currentValue = h.getCurrentValue(currentPrice);
                snapshots.add(new HoldingSnapshot(
                    stock, h.getQuantity(), h.getAverageCost(),
                    currentPrice, currentValue, pnl, pnlPct
                ));
            });
        }
        snapshots.sort((a, b) -> Double.compare(b.getCurrentValue(), a.getCurrentValue()));
        return snapshots;
    }

    public String getPortfolioRating(User user) {
        double returnPct = getTotalReturnPercent(user);
        Map<String, Double> sectors = getSectorAllocation(user);
        int numHoldings = user.getPortfolio().getHoldings().size();

        if (returnPct > 20 && numHoldings >= 5) return "⭐⭐⭐⭐⭐ Exceptional";
        if (returnPct > 10 && numHoldings >= 3) return "⭐⭐⭐⭐  Strong";
        if (returnPct > 5) return "⭐⭐⭐   Good";
        if (returnPct > 0) return "⭐⭐    Fair";
        if (returnPct > -10) return "⭐     Weak";
        return "      Struggling";
    }

    /** Inner class: snapshot of a holding's current state */
    public static class HoldingSnapshot {
        public final Stock stock;
        public final int quantity;
        public final double avgCost;
        public final double currentPrice;
        public final double currentValue;
        public final double unrealizedPnL;
        public final double unrealizedPnLPct;

        public HoldingSnapshot(Stock stock, int quantity, double avgCost,
                                double currentPrice, double currentValue,
                                double pnl, double pnlPct) {
            this.stock = stock;
            this.quantity = quantity;
            this.avgCost = avgCost;
            this.currentPrice = currentPrice;
            this.currentValue = currentValue;
            this.unrealizedPnL = pnl;
            this.unrealizedPnLPct = pnlPct;
        }

        public double getCurrentValue() { return currentValue; }
    }
}
