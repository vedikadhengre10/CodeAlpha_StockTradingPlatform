
package service;

import model.Transaction;

/**
 * Result object for trade operations — contains success/failure state and message
 */
public class TransactionResult {
    private final boolean success;
    private final String message;
    private final Transaction transaction;

    private TransactionResult(boolean success, String message, Transaction transaction) {
        this.success = success;
        this.message = message;
        this.transaction = transaction;
    }

    public static TransactionResult success(Transaction tx, String message) {
        return new TransactionResult(true, message, tx);
    }

    public static TransactionResult failure(String message) {
        return new TransactionResult(false, message, null);
    }

    public boolean isSuccess() { return success; }
    public String getMessage() { return message; }
    public Transaction getTransaction() { return transaction; }
}
