

package service;

import model.*;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Manages price alerts and notifies users when targets are hit
 */
public class AlertService {
    private final Map<String, List<PriceAlert>> alertsByUser;
    private final MarketService marketService;
    private int alertCounter;

    public AlertService(MarketService marketService) {
        this.alertsByUser = new HashMap<>();
        this.marketService = marketService;
        this.alertCounter = 1;
    }

    public String createAlert(String userId, String symbol,
                               PriceAlert.AlertType type, double targetPrice) {
        Optional<Stock> stock = marketService.getStock(symbol);
        if (stock.isEmpty()) throw new IllegalArgumentException("Stock not found: " + symbol);

        String alertId = "ALT" + String.format("%04d", alertCounter++);
        PriceAlert alert = new PriceAlert(alertId, userId, symbol, type, targetPrice);
        alertsByUser.computeIfAbsent(userId, k -> new ArrayList<>()).add(alert);
        return alertId;
    }

    public List<PriceAlert> checkAlerts(String userId) {
        List<PriceAlert> triggered = new ArrayList<>();
        List<PriceAlert> alerts = alertsByUser.getOrDefault(userId, Collections.emptyList());

        for (PriceAlert alert : alerts) {
            if (alert.getStatus() != PriceAlert.AlertStatus.ACTIVE) continue;
            Optional<Stock> stockOpt = marketService.getStock(alert.getSymbol());
            stockOpt.ifPresent(stock -> {
                if (alert.shouldTrigger(stock.getCurrentPrice())) {
                    alert.trigger(stock.getCurrentPrice());
                    triggered.add(alert);
                }
            });
        }
        return triggered;
    }

    public void cancelAlert(String userId, String alertId) {
        alertsByUser.getOrDefault(userId, Collections.emptyList()).stream()
            .filter(a -> a.getAlertId().equals(alertId))
            .findFirst()
            .ifPresent(a -> a.setStatus(PriceAlert.AlertStatus.CANCELLED));
    }

    public List<PriceAlert> getActiveAlerts(String userId) {
        return alertsByUser.getOrDefault(userId, Collections.emptyList()).stream()
            .filter(a -> a.getStatus() == PriceAlert.AlertStatus.ACTIVE)
            .collect(Collectors.toList());
    }

    public List<PriceAlert> getAllAlerts(String userId) {
        return new ArrayList<>(alertsByUser.getOrDefault(userId, Collections.emptyList()));
    }
}
