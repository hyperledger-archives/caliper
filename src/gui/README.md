This is an implementation of temporary GUI demo. 

SSH is used to start remote benchmark and fetch results (which are updated in temporary log files) periodically. In order to setup the SSH connection, please modify www/remotecontrol.php to define the host address and login name/password. 

Only 'simple' benchmark is integrated into the GUI.

* /www, contains the web pages and php files. Echart v2.2.7 from Baidu company is used to draw dynamic charts.
* /src, contains interfaces for caliper benchmark to update performance log