"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config = {
    tree: [],
    $schema: "",
    // @ts-ignore
    bindInfo: {
        port: 8080,
        bindAddress: ["127.0.0.1" /* "0.0.0.0" */ /* "192.168.0.0/16" */],
        bindWildcard: false,
        enableIPv6: false,
        filterBindAddress: false,
        https: "./https.js",
        localAddressPermissions: {
            "*": {
                loginlink: false,
                mkdir: false,
                putsaver: false,
                registerNotice: false,
                upload: false,
                websockets: false,
                writeErrors: false
            }
        },
        _bindLocalhost: false
    }
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVzdC10eXBlcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInRlc3QtdHlwZXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFPQSxNQUFNLE1BQU0sR0FBdUI7SUFDakMsSUFBSSxFQUFFLEVBQUU7SUFDUixPQUFPLEVBQUUsRUFBRTtJQUNYLGFBQWE7SUFDYixRQUFRLEVBQUU7UUFDUixJQUFJLEVBQUUsSUFBSTtRQUNWLFdBQVcsRUFBRSxDQUFDLFdBQVcsQ0FBQyxlQUFlLENBQUMsc0JBQXNCLENBQUM7UUFDakUsWUFBWSxFQUFFLEtBQUs7UUFDbkIsVUFBVSxFQUFFLEtBQUs7UUFDakIsaUJBQWlCLEVBQUUsS0FBSztRQUN4QixLQUFLLEVBQUUsWUFBWTtRQUNuQix1QkFBdUIsRUFBRTtZQUN2QixHQUFHLEVBQUU7Z0JBQ0gsU0FBUyxFQUFFLEtBQUs7Z0JBQ2hCLEtBQUssRUFBRSxLQUFLO2dCQUNaLFFBQVEsRUFBRSxLQUFLO2dCQUNmLGNBQWMsRUFBRSxLQUFLO2dCQUNyQixNQUFNLEVBQUUsS0FBSztnQkFDYixVQUFVLEVBQUUsS0FBSztnQkFDakIsV0FBVyxFQUFFLEtBQUs7YUFDbkI7U0FDRjtRQUNELGNBQWMsRUFBRSxLQUFLO0tBQ3RCO0NBQ0YsQ0FBQyJ9