

package service;

import model.User;
import model.Watchlist;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.*;

/**
 * Manages user accounts, authentication, and watchlists
 */
public class UserService {
    private final Map<String, User> users;           // userId -> User
    private final Map<String, String> usernameIndex; // username -> userId
    private final Map<String, Watchlist> watchlists; // userId -> Watchlist
    private int nextUserId;

    public UserService() {
        this.users = new HashMap<>();
        this.usernameIndex = new HashMap<>();
        this.watchlists = new HashMap<>();
        this.nextUserId = 1000;
    }

    public User register(String username, String password, String email, double initialDeposit) {
        if (username == null || username.trim().isEmpty())
            throw new IllegalArgumentException("Username cannot be empty");
        if (usernameIndex.containsKey(username.toLowerCase()))
            throw new IllegalArgumentException("Username already taken: " + username);
        if (password == null || password.length() < 4)
            throw new IllegalArgumentException("Password must be at least 4 characters");
        if (initialDeposit < 0)
            throw new IllegalArgumentException("Initial deposit cannot be negative");

        String userId = "USR" + (nextUserId++);
        String passwordHash = hashPassword(password);
        User user = new User(userId, username, passwordHash, email, initialDeposit);
        users.put(userId, user);
        usernameIndex.put(username.toLowerCase(), userId);
        watchlists.put(userId, new Watchlist(userId));
        return user;
    }

    public Optional<User> authenticate(String username, String password) {
        String userId = usernameIndex.get(username.toLowerCase());
        if (userId == null) return Optional.empty();
        User user = users.get(userId);
        if (user == null || !user.isActive()) return Optional.empty();
        if (!user.getPasswordHash().equals(hashPassword(password))) return Optional.empty();
        user.setLastLogin(LocalDateTime.now());
        return Optional.of(user);
    }

    public Optional<User> getUserById(String userId) {
        return Optional.ofNullable(users.get(userId));
    }

    public Optional<User> getUserByUsername(String username) {
        String userId = usernameIndex.get(username.toLowerCase());
        return userId != null ? Optional.ofNullable(users.get(userId)) : Optional.empty();
    }

    public Watchlist getWatchlist(String userId) {
        return watchlists.computeIfAbsent(userId, Watchlist::new);
    }

    public void addToWatchlist(String userId, String symbol) {
        getWatchlist(userId).add(symbol);
    }

    public void removeFromWatchlist(String userId, String symbol) {
        getWatchlist(userId).remove(symbol);
    }

    public boolean changePassword(String userId, String oldPassword, String newPassword) {
        Optional<User> userOpt = getUserById(userId);
        if (userOpt.isEmpty()) return false;
        User user = userOpt.get();
        if (!user.getPasswordHash().equals(hashPassword(oldPassword))) return false;
        if (newPassword == null || newPassword.length() < 4) return false;
        user.setPasswordHash(hashPassword(newPassword));
        return true;
    }

    public List<User> getAllUsers() {
        return new ArrayList<>(users.values());
    }

    public List<User> getLeaderboard() {
        List<User> all = new ArrayList<>(users.values());
        all.sort((a, b) -> Double.compare(b.getNetProfitLoss(), a.getNetProfitLoss()));
        return all;
    }

    private String hashPassword(String password) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(password.getBytes());
            StringBuilder sb = new StringBuilder();
            for (byte b : hash) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            // Fallback simple hash
            return Integer.toHexString(password.hashCode());
        }
    }

    public int getUserCount() { return users.size(); }
}
